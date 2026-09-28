import { useEffect, useRef } from 'react'
import { XIcon } from '../common/Icons'
import CalendarView from './CalendarView'
import './CalendarDialog.css'

export default function CalendarDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="calendar-dialog"
      aria-label="לוח שנה"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current?.close()
      }}
    >
      <button type="button" className="icon-button calendar-dialog-close" aria-label="סגירה" onClick={() => dialog.current?.close()}>
        <XIcon />
      </button>
      <CalendarView embedded />
    </dialog>
  )
}
