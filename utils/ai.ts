// Thin AI interface for assessment generation (PRD §14.3: one provider behind
// a swappable internal interface). Uses the OpenAI-compatible Chat Completions
// API so OPENAI_BASE_URL can point at OpenRouter, Ollama, Azure, etc.
//
// SERVER ONLY — contains no secrets itself but must never enter a client graph.
import OpenAI from 'openai';
import type { AssessmentQuestion } from '@/utils/db/schema';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_QUESTIONS = 10;

export class AIUnavailableError extends Error {
  constructor() {
    super('AI provider is not configured (OPENAI_API_KEY missing).');
    this.name = 'AIUnavailableError';
  }
}

export type AssessmentSource = 'captions' | 'metadata';

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
  });
}

function buildPrompt(title: string, author: string | null, transcript: string | null) {
  const sourceBlock = transcript
    ? `Below is the transcript of the video.\n---\n${transcript}\n---`
    : `No transcript is available. Base questions only on what can reasonably be
inferred from the title and channel; keep every question answerable from
general knowledge of the stated topic and avoid invented specifics.`;

  return `You are an assessor creating a multiple-choice quiz about one YouTube video.

Video title: ${title}
Channel: ${author ?? 'unknown'}

${sourceBlock}

Create exactly ${MAX_QUESTIONS} multiple-choice questions grounded in the content above.
Rules:
- Each question has exactly one correct answer and exactly 3 distractors (4 choices total).
- Questions must reference only content present in the source material above.
- Keep questions under 20 words; choices under 15 words.
- Do not reference "the transcript" or "the video" in question text; be self-contained.
- Vary difficulty: recall, comprehension, and application.

Respond with JSON only, matching this schema:
{"questions":[{"prompt":"string","choices":["string","string","string","string"],"correct":0}]}
"correct" is the 0-based index of the correct choice.`;
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
    const { prompt, choices, correct } = entry as {
      prompt?: unknown;
      choices?: unknown;
      correct?: unknown;
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
    questions.push({
      prompt: prompt.trim(),
      choices: choices.map((c) => c.trim()),
      correct,
    });
    if (questions.length === MAX_QUESTIONS) break;
  }

  if (questions.length < MAX_QUESTIONS) {
    throw new Error(`AI returned only ${questions.length} valid questions`);
  }
  return questions;
}

/**
 * Generate a grounded assessment for one video. Throws AIUnavailableError when
 * no key is configured, or Error on malformed/failed generations — callers map
 * these to a `{ message }` and must not persist partial data (FR-D2 AC4).
 */
export async function generateAssessment(
  title: string,
  author: string | null,
  transcript: string | null
): Promise<GenerationResult> {
  const client = getClient();

  const response = await client.chat.completions.create({
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

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('AI returned an empty response');

  return {
    questions: parseQuestions(raw),
    source: transcript ? 'captions' : 'metadata',
  };
}
