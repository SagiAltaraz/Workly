import type { Field } from '../../types/provenance'
import { useApp } from '../../context/AppContext'
import { QuoteIcon, WarningIcon } from './Icons'
import './QuoteBox.css'

interface QuoteBoxProps {
  field: Field
  label: string
}

// The sentence a card was read from. Clicking it opens the source text with that span marked.
export default function QuoteBox({ field, label }: QuoteBoxProps) {
  const { showSource } = useApp()
  const text = field.quote
  if (!text) return null

  return (
    <button
      type="button"
      className={`quote-box${field.verified ? '' : ' quote-box-unverified'}`}
      onClick={() => showSource({ field, label })}
      title="הצג בטקסט המקור"
    >
      <span className="quote-box-icon">{field.verified ? <QuoteIcon size={16} /> : <WarningIcon size={16} />}</span>
      <span className="quote-box-text">&quot;{text}&quot;</span>
    </button>
  )
}
