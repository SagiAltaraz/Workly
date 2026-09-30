import { useEffect, useRef } from 'react'
import type { Field } from '../../types/provenance'
import type { SourceInput } from '../../types/workspace'
import { splitAroundSpan } from '../../utils/sourceText'
import './SourceExcerpt.css'

interface SourceExcerptProps {
  field: Field
  sources: SourceInput[]
}

// The pasted text a value came from, with the exact words marked. Shown inside a card's full view.
export default function SourceExcerpt({ field, sources }: SourceExcerptProps) {
  const mark = useRef<HTMLElement>(null)
  const source = field.span ? sources.find((item) => item.id === field.span?.inputId) : undefined
  const parts = source && field.span ? splitAroundSpan(source.text, field.span) : null

  useEffect(() => {
    mark.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  if (!parts) {
    return (
      <p className="source-excerpt-none">
        {field.editedByUser ? 'נוצר או נערך ידנית, ואין לו טקסט מקור.' : 'לא נמצא בטקסט המקור ציטוט שמתאים לערך הזה.'}
      </p>
    )
  }
  return (
    <pre className="source-excerpt" dir="rtl">
      {parts.before}
      <mark ref={mark}>{parts.match}</mark>
      {parts.after}
    </pre>
  )
}
