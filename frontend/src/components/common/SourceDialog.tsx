import { useEffect, useRef } from 'react'
import type { SourceRequest } from '../../context/AppContext'
import type { SourceInput } from '../../types/workspace'
import { splitAroundSpan } from '../../utils/sourceText'
import FactChip from './FactChip'
import { XIcon } from './Icons'
import './SourceDialog.css'

interface SourceDialogProps {
  request: SourceRequest
  sources: SourceInput[]
  onClose: () => void
}

// Shows the pasted text a value came from, with the exact span marked.
export default function SourceDialog({ request, sources, onClose }: SourceDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const mark = useRef<HTMLElement>(null)
  const { field, label } = request
  const source = field.span ? sources.find((item) => item.id === field.span?.inputId) : undefined
  const parts = source && field.span ? splitAroundSpan(source.text, field.span) : null

  useEffect(() => {
    dialog.current?.showModal()
    mark.current?.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <dialog
      ref={dialog}
      className="source-dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current?.close()
      }}
    >
      <header className="source-dialog-header">
        <div>
          <h2>{label}</h2>
          {field.value && <p className="source-dialog-value">{field.value}</p>}
        </div>
        <div className="source-dialog-tools">
          <FactChip field={field} label={label} compact />
          <button type="button" className="icon-button" aria-label="סגירה" onClick={() => dialog.current?.close()}>
            <XIcon />
          </button>
        </div>
      </header>

      {parts ? (
        <pre className="source-dialog-text" dir="rtl">
          {parts.before}
          <mark ref={mark}>{parts.match}</mark>
          {parts.after}
        </pre>
      ) : (
        <div className="source-dialog-missing">
          <p>לא נמצא בטקסט המקור ציטוט שמתאים לערך הזה, ולכן הוא לא נחשב עובדה מאומתת.</p>
          {field.quote && (
            <p className="source-dialog-claimed">
              הציטוט שהמודל טען: <q>{field.quote}</q>
            </p>
          )}
        </div>
      )}
    </dialog>
  )
}
