// Onboarding form validation schemas using Zod
// These schemas are client-safe (no server-only imports)

import { z } from 'zod'

/**
 * Schema for onboarding form data.
 * Validates all fields required for the onboarding process.
 */
export const onboardingSchema = z.object({
  /** User's full name */
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),

  /** User's email address */
  email: z.string().email('Invalid email address').max(255, 'Email is too long'),

  /** User's date of birth */
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
    .refine(
      (val) => {
        const date = new Date(val)
        return !isNaN(date.getTime()) && date <= new Date()
      },
      'Date of birth must be a valid date not in the future'
    ),

  /** User's plan type */
  plan: z.enum(['free', 'starter', 'pro', 'pro_yearly']),

  /** Acceptance of terms */
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
})

/**
 * Type inferred from the onboarding schema
 */
export type OnboardingFormValues = z.infer<typeof onboardingSchema>

/**
 * Schema for verifying onboarding completion.
 */
export const onboardingCompletionSchema = z.object({
  /** User's name */
  name: z.string().min(1, 'Name is required'),

  /** User's email */
  email: z.string().email('Invalid email').max(255),

  /** Onboarding was completed */
  completed: z.boolean().default(true),
})

/**
 * Type inferred from the onboarding completion schema
 */
export type OnboardingCompletionValues = z.infer<typeof onboardingCompletionSchema>