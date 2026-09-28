import { createOpenAiExtractor } from '../agents/openai.extractor'
import type { Extractor } from '../agents/extractor'
import { env } from '../config/env'

// Null when no key is configured: the app still starts, and extraction says why it cannot run.
export const extractor: Extractor | null = env.openaiApiKey
  ? createOpenAiExtractor(env.openaiApiKey, env.model)
  : null
