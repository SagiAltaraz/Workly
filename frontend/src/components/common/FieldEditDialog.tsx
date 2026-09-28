import { useEffect, useRef, useState } from 'react'
import type { EditRequest } from '../../context/AppContext'
import './FieldEditDialog.css'

interface FieldEditDialogProps {
  request: EditRequest
  onClose: () => void
}

export default function FieldEditDialog({ request, onClose }: FieldEditDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(request.currentValue ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  async function submit() {
    if (value.trim().length === 0 || saving) return
    setSaving(true)
    const saved = await request.save(value.trim())
    setSaving(false)
    if (saved) dialog.current?.close()
  }

  async function clear() {
    if (!request.clear || saving) return
    setSaving(true)
    const cleared = await request.clear()
    setSaving(false)
    if (cleared) dialog.current?.close()
  }

  return (
    <dialog ref={dialog} className="edit-dialog" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <h2>עריכה: {request.label}</h2>
        <p className="edit-dialog-note">{request.hint ?? 'ערך שנערך ידנית גובר על כל מה שהמערכת קראה מהטקסט.'}</p>
        <input
          type={request.kind}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoFocus
          dir={request.kind === 'text' ? 'rtl' : 'ltr'}
        />
        <div className="edit-dialog-actions">
          {request.clear && request.currentValue !== null && (
            <button type="button" className="edit-dialog-clear" disabled={saving} onClick={() => void clear()}>
              ניקוי הערך
            </button>
          )}
          <button type="button" className="edit-dialog-cancel" onClick={() => dialog.current?.close()}>
            ביטול
          </button>
          <button type="submit" className="edit-dialog-save" disabled={saving || value.trim().length === 0}>
            שמירה
          </button>
        </div>
      </form>
    </dialog>
  )
}
