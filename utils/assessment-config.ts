// Shared, client-safe assessment configuration (no server-only imports, so
// both the LLM generator and the interactive UI copy can read it).
// Single source of truth for the question count — raise to 10–15 later.
export const ASSESSMENT_QUESTION_COUNT = 2;
