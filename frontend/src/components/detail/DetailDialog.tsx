import { useEffect, useRef, type ReactNode } from 'react'
import { XIcon } from '../common/Icons'
import './DetailDialog.css'

interface DetailDialogProps {
  kind: string
  title: string
  tone: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
}

// The frame of a card opened in full: a header, a body of fields, and the actions.
export default function DetailDialog({ kind, title, tone, onClose, children, footer }: DetailDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      className={`detail-dialog tone-${tone}`}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current?.close()
      }}
    >
      <header className="detail-header">
        <span className="detail-kind">{kind}</span>
        <h2>{title}</h2>
        <button type="button" className="icon-button" aria-label="סגירה" onClick={() => dialog.current?.close()}>
          <XIcon />
        </button>
      </header>
      <div className="detail-body">{children}</div>
      <footer className="detail-footer">{footer}</footer>
    </dialog>
  )
}
