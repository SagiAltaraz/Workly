import { z } from 'zod'

const quotedValue = z.object({
  value: z.string(),
  quote: z.string(),
})

const quotedDate = z.object({
  dateText: z.string(),
  quote: z.string(),
})

export const briefSignalSchema = z.object({
  client: quotedValue.nullable(),
  campaign: quotedValue.nullable(),
  message: quotedValue.nullable(),
  audience: quotedValue.nullable(),
  tone: quotedValue.nullable(),
  deadline: quotedDate.nullable(),
  launchDate: quotedDate.nullable(),
  deliverables: z.array(quotedValue),
  constraints: z.array(quotedValue),
  suggestions: z.array(z.string()),
  missingDetails: z.array(z.string()),
})

// One entry per distinct brief found in the text. Empty when the text holds no brief at all.
export const briefSignalsSchema = z.object({
  briefs: z.array(briefSignalSchema),
})

export type BriefSignal = z.infer<typeof briefSignalSchema>
export type BriefSignals = z.infer<typeof briefSignalsSchema>
