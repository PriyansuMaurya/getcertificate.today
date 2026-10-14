// Assessment form validation schemas using Zod
// These schemas are client-safe (no server-only imports)

import { z } from 'zod'

/**
 * Schema for a single assessment answer.
 * Validates that the user's answer is valid for a given question.
 */
export const assessmentAnswerSchema = z.object({
  /** The selected answer option */
  answer: z.string().min(1, 'Answer is required'),

  /** Whether the answer was completed */
  completed: z.boolean().default(false),
})

/**
 * Type inferred from the assessment answer schema
 */
export type AssessmentAnswerValues = z.infer<typeof assessmentAnswerSchema>

/**
 * Schema for assessment submission.
 * Validates the complete assessment submission.
 */
export const assessmentSubmissionSchema = z.object({
  /** The learning item ID */
  learningItemId: z.string().min(1, 'Learning item ID is required'),

  /** The answers provided */
  answers: z.array(assessmentAnswerSchema).min(1, 'At least one answer is required'),

  /** The total watch time in seconds */
  watchTimeSeconds: z
    .number()
    .int('Watch time must be an integer')
    .min(0, 'Watch time must be at least 0'),

  /** Whether the assessment was completed */
  completed: z.boolean().default(false),
})

/**
 * Type inferred from the assessment submission schema
 */
export type AssessmentSubmissionValues = z.infer<typeof assessmentSubmissionSchema>