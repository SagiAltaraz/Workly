import { z } from 'zod'

const quotedValue = z.object({
  value: z.string(),
  quote: z.string(),
})

const quotedDate = z.object({
  dateText: z.string(),
  quote: z.string(),
})

export const briefSignalsSchema = z.object({
  containsBrief: z.boolean(),
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

export type BriefSignals = z.infer<typeof briefSignalsSchema>
