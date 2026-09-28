import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import './MeetingFormDialog.css'

interface MeetingFormDialogProps {
  initialDate: string
  onClose: () => void
}

export default function MeetingFormDialog({ initialDate, onClose }: MeetingFormDialogProps) {
  const { app } = useApp()
  const dialog = useRef<HTMLDialogElement>(null)
  const [topic, setTopic] = useState('')
  const [date, setDate] = useState(initialDate)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [participants, setParticipants] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  async function submit() {
    if (topic.trim().length === 0 || saving) return
    setSaving(true)
    const saved = await app.addMeeting({
      topic: topic.trim(),
      date: date || null,
      startTime: startTime || null,
      endTime: endTime || null,
      participants: participants.split(/[,،]/).map((name) => name.trim()).filter(Boolean),
    })
    setSaving(false)
    if (saved) dialog.current?.close()
  }

  return (
    <dialog ref={dialog} className="meeting-form" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <h2>פגישה חדשה</h2>
        <label>
          נושא
          <input value={topic} onChange={(event) => setTopic(event.target.value)} autoFocus />
        </label>
        <label>
          תאריך
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} dir="ltr" />
        </label>
        <div className="meeting-form-times">
          <label>
            התחלה
            <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} dir="ltr" />
          </label>
          <label>
            סיום
            <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} dir="ltr" />
          </label>
        </div>
        <label>
          משתתפים (מופרדים בפסיקים)
          <input value={participants} onChange={(event) => setParticipants(event.target.value)} />
        </label>
        <p className="meeting-form-note">בלי שעה, הפגישה תופיע כממתינה לתיאום.</p>
        <div className="meeting-form-actions">
          <button type="button" className="meeting-form-cancel" onClick={() => dialog.current?.close()}>
            ביטול
          </button>
          <button type="submit" className="meeting-form-save" disabled={saving || topic.trim().length === 0}>
            הוספה
          </button>
        </div>
      </form>
    </dialog>
  )
}
