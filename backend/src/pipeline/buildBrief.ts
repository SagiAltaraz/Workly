import type { BriefSignals } from '../agents/brief/brief.schema'
import { randomUUID } from 'node:crypto'
import type { Brief, BriefFieldKey, BriefItem } from '../types/brief'
import type { Field } from '../types/provenance'
import { assumedField, missingField, sourcedField, type SourceContext } from './fields'
import { normalizeText } from './normalize'
import { parseDate } from './parseDate'

function textField(context: SourceContext, signal: { value: string; quote: string } | null): Field {
  if (!signal || signal.value.trim().length === 0) return missingField()
  const value = normalizeText(signal.value)
  return sourcedField(context, { value, status: 'stated', quote: signal.quote, evidenceText: value })
}

function dateField(
  context: SourceContext,
  signal: { dateText: string; quote: string } | null,
  referenceDate: string,
): Field {
  if (!signal) return missingField()
  const parsed = parseDate(normalizeText(signal.dateText), referenceDate)
  if (!parsed) return missingField(`לא הצלחתי להבין את התאריך "${signal.dateText}"`)
  return sourcedField(context, {
    value: parsed.date,
    status: parsed.kind === 'explicit' ? 'stated' : 'inferred',
    quote: signal.quote,
    evidenceText: normalizeText(signal.dateText),
  })
}

// Returns null when the text holds no brief at all, so an empty brief never shows up.
export function buildBrief(
  context: SourceContext,
  signals: BriefSignals,
  referenceDate: string,
): Brief | null {
  if (!signals.containsBrief) return null

  const fields: Record<BriefFieldKey, Field> = {
    client: textField(context, signals.client),
    campaign: textField(context, signals.campaign),
    message: textField(context, signals.message),
    audience: textField(context, signals.audience),
    tone: textField(context, signals.tone),
    deadline: dateField(context, signals.deadline, referenceDate),
    launchDate: dateField(context, signals.launchDate, referenceDate),
  }

  const item = (field: Field): BriefItem => ({ id: randomUUID(), field, deleted: false })
  const usable = (field: Field) => field.value !== null
  return {
    fields,
    deliverables: signals.deliverables.map((entry) => textField(context, entry)).filter(usable).map(item),
    constraints: signals.constraints.map((entry) => textField(context, entry)).filter(usable).map(item),
    suggestions: signals.suggestions.map((text) => item(assumedField(normalizeText(text)))),
    missingDetails: signals.missingDetails.map((text) => item({ ...missingField(), value: normalizeText(text) })),
  }
}
