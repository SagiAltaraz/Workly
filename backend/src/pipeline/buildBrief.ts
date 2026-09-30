import type { BriefSignal } from '../agents/brief/brief.schema'
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

function buildOneBrief(context: SourceContext, signal: BriefSignal, referenceDate: string): Brief {
  const fields: Record<BriefFieldKey, Field> = {
    client: textField(context, signal.client),
    campaign: textField(context, signal.campaign),
    message: textField(context, signal.message),
    audience: textField(context, signal.audience),
    tone: textField(context, signal.tone),
    deadline: dateField(context, signal.deadline, referenceDate),
    launchDate: dateField(context, signal.launchDate, referenceDate),
  }

  const item = (field: Field): BriefItem => ({ id: randomUUID(), field, deleted: false })
  const usable = (field: Field) => field.value !== null
  return {
    id: randomUUID(),
    fields,
    deliverables: signal.deliverables.map((entry) => textField(context, entry)).filter(usable).map(item),
    constraints: signal.constraints.map((entry) => textField(context, entry)).filter(usable).map(item),
    suggestions: signal.suggestions.map((text) => item(assumedField(normalizeText(text)))),
    missingDetails: signal.missingDetails.map((text) => item({ ...missingField(), value: normalizeText(text) })),
  }
}

// One brief per distinct client request the agent found; [] when the text held none.
export function buildBriefs(context: SourceContext, signals: BriefSignal[], referenceDate: string): Brief[] {
  return signals.map((signal) => buildOneBrief(context, signal, referenceDate))
}
