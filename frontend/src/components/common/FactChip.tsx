import type { Field } from '../../types/provenance'
import { statusHints, statusLabels } from '../../utils/labels'
import { useApp } from '../../context/AppContext'
import './FactChip.css'

interface FactChipProps {
  field: Field
  label: string
  // Compact chips sit inside cards next to a date or a time.
  compact?: boolean
}

type ChipKind = 'stated' | 'inferred' | 'assumed' | 'missing' | 'unverified' | 'edited'

function chipOf(field: Field): { kind: ChipKind; text: string; hint: string } {
  if (field.editedByUser) return { kind: 'edited', text: 'נערך ידנית', hint: 'ערך שהוזן ידנית. גובר על כל מה שמודל הפיק' }
  const claimsFact = field.status === 'stated' || field.status === 'inferred'
  if (claimsFact && field.value !== null && !field.verified) {
    return { kind: 'unverified', text: 'לא מאומת', hint: 'הציטוט לא נמצא בטקסט המקור, ולכן זה לא נחשב עובדה' }
  }
  return { kind: field.status, text: statusLabels[field.status], hint: statusHints[field.status] }
}

// The status of one value; clicking it shows where in the source text the value came from.
export default function FactChip({ field, label, compact = false }: FactChipProps) {
  const { showSource } = useApp()
  const chip = chipOf(field)
  const className = `fact-chip fact-chip-${chip.kind}${compact ? ' fact-chip-compact' : ''}`
  // How a value was read (a corrected spelling slip, for instance) is part of the explanation.
  const explanation = field.note && field.status !== 'missing' ? `${chip.hint}. ${field.note}` : chip.hint
  const canShowSource = field.quote !== null || field.span !== null

  if (!canShowSource) {
    return (
      <span className={className} title={explanation}>
        {chip.text}
      </span>
    )
  }
  return (
    <button
      type="button"
      className={className}
      title={`${explanation}. לחיצה מציגה את המקור בטקסט`}
      onClick={() => showSource({ field, label })}
    >
      {chip.text}
    </button>
  )
}
