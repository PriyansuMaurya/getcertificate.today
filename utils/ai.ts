// Thin AI interface for assessment generation (PRD §14.3: one provider behind
// a swappable internal interface). Uses the OpenAI-compatible Chat Completions
// API so OPENAI_BASE_URL can point at OpenRouter, Ollama, Azure, etc.
//
// SERVER ONLY — contains no secrets itself but must never enter a client graph.
import OpenAI from 'openai';
import type { AssessmentQuestion } from '@/utils/db/schema';
import { ASSESSMENT_QUESTION_COUNT } from '@/utils/assessment-config';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
// Keep the whole generation bounded so the UI can never hang indefinitely:
// worst case ≈ 2 attempts × 30s + 2s backoff ≈ 62s (timeouts and 429/5xx both
// consume the one retry; auth/config errors still fail fast).
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 2000;

export class AIUnavailableError extends Error {
  constructor() {
    super('AI provider is not configured (OPENAI_API_KEY missing).');
    this.name = 'AIUnavailableError';
  }
}

/** 429/rate-limit from the LLM provider — distinct copy from generic failure. */
export class AIRateLimitError extends Error {
  constructor() {
    super('AI provider rate limit reached.');
    this.name = 'AIRateLimitError';
  }
}

/** Generation exceeded REQUEST_TIMEOUT_MS — the action maps this to copy. */
export class AITimeoutError extends Error {
  constructor() {
    super('AI generation timed out.');
    this.name = 'AITimeoutError';
  }
}

export type AssessmentSource = 'transcriptapi';

type GenerationResult = {
  questions: AssessmentQuestion[];
  source: AssessmentSource;
};

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AIUnavailableError();
  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 0, // retries are handled explicitly below (rate-limit aware)
  });
}

function buildPrompt(title: string, author: string | null, transcript: string) {
  return `You are an assessor creating a multiple-choice quiz about one YouTube video.

Video title: ${title}
Channel: ${author ?? 'unknown'}

Below is the transcript of the video.
---
${transcript}
---

Create exactly ${ASSESSMENT_QUESTION_COUNT} multiple-choice questions grounded STRICTLY in the transcript above.
Rules:
- Each question has exactly one correct answer and exactly 3 distractors (4 choices total).
- Questions must reference only content present in the transcript above.
- Keep questions under 20 words; choices under 15 words.
- Do not reference "the transcript" or "the video" in question text; be self-contained.
- Vary difficulty: recall, comprehension, and application.
- "explanation" must state WHY the correct answer is correct, citing the relevant fact from the transcript (1-2 sentences).
- "choice_explanations" must have exactly 4 entries aligned with "choices": for the correct choice explain why it is right; for each distractor explain specifically why it is wrong (1-2 sentences each).

Respond with JSON only, matching this schema:
{"questions":[{"prompt":"string","choices":["string","string","string","string"],"correct":0,"explanation":"string","choice_explanations":["string","string","string","string"]}]}
"correct" is the 0-based index of the correct choice.`;
}

/** Strip control chars and collapse whitespace — sanitization before parsing. */
function cleanText(raw: string, maxLength: number): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function parseQuestions(raw: string): AssessmentQuestion[] {
  // Strip code fences if the model wrapped the JSON.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const parsed: unknown = JSON.parse(cleaned);
  if (typeof parsed !== 'object' || parsed === null || !('questions' in parsed)) {
    throw new Error('AI response missing questions');
  }
  const list = (parsed as { questions: unknown }).questions;
  if (!Array.isArray(list)) throw new Error('AI response questions is not an array');

  const questions: AssessmentQuestion[] = [];
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { prompt, choices, correct, explanation, choice_explanations } = entry as {
      prompt?: unknown;
      choices?: unknown;
      correct?: unknown;
      explanation?: unknown;
      choice_explanations?: unknown;
    };
    if (
      typeof prompt !== 'string' ||
      !Array.isArray(choices) ||
      choices.length !== 4 ||
      !choices.every((c) => typeof c === 'string' && c.trim().length > 0) ||
      typeof correct !== 'number' ||
      !Number.isInteger(correct) ||
      correct < 0 ||
      correct > 3
    ) {
      continue;
    }

    // Explanations are required for new assessments (instant-feedback flow).
    if (typeof explanation !== 'string' || explanation.trim().length === 0) continue;
    if (
      !Array.isArray(choice_explanations) ||
      choice_explanations.length !== 4 ||
      !choice_explanations.every((c) => typeof c === 'string' && c.trim().length > 0)
    ) {
      continue;
    }

    questions.push({
      prompt: cleanText(prompt, 300),
      choices: choices.map((c) => cleanText(c, 200)),
      correct,
      explanation: cleanText(explanation, 600),
      choice_explanations: choice_explanations.map((c) => cleanText(c, 600)),
    });
    if (questions.length === ASSESSMENT_QUESTION_COUNT) break;
  }

  if (questions.length < ASSESSMENT_QUESTION_COUNT) {
    throw new Error(`AI returned only ${questions.length} valid questions`);
  }
  return questions;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a grounded assessment for one video from its transcript. Throws
 * AIUnavailableError when no key is configured, AIRateLimitError /
 * AITimeoutError for those failure modes, or Error on malformed generations —
 * callers map these to a `{ message }` and must not persist partial data
 * (FR-D2 AC4). Retries transient 429/5xx with backoff; never hangs past
 * REQUEST_TIMEOUT_MS per attempt.
 */
export async function generateAssessment(
  title: string,
  author: string | null,
  transcript: string
): Promise<GenerationResult> {
  const client = getClient();

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS * attempt);
    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You generate strictly-formatted multiple-choice assessments. Always respond with valid JSON matching the requested schema.',
          },
          { role: 'user', content: buildPrompt(title, author, transcript) },
        ],
      });
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number } | null)?.status;
      const isRate = status === 429;
      const isTimeout = err instanceof OpenAI.APIConnectionTimeoutError;
      const isServer = typeof status === 'number' && status >= 500;
      // Transient: rate limit, server errors, and timeouts all get one retry
      // within the budget; auth/config/other 4xx fail fast.
      if (!isRate && !isServer && !isTimeout) throw err;
      if (attempt === MAX_RETRIES) {
        if (isRate) throw new AIRateLimitError();
        if (isTimeout) throw new AITimeoutError();
        throw err;
      }
      continue;
    }

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      lastError = new Error('AI returned an empty response');
      continue; // transient malformed output — retry within budget
    }
    try {
      return {
        questions: parseQuestions(raw),
        source: 'transcriptapi',
      };
    } catch (err) {
      lastError = err; // invalid JSON/short list — retry within budget
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('AI generation failed after retries');
}
