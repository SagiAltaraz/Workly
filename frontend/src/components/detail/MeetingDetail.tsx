import { useState } from 'react'
import type { MeetingPatch } from '../../api/workspaceApi'
import { useApp } from '../../context/AppContext'
import { buildIcs, downloadIcs } from '../../utils/ics'
import FactChip from '../common/FactChip'
import { WarningIcon } from '../common/Icons'
import SourceExcerpt from '../common/SourceExcerpt'
import { closeDialogOf } from './closeDialog'
import DetailDialog from './DetailDialog'

const splitNames = (text: string) => text.split(/[,،]/).map((name) => name.trim()).filter(Boolean)

export default function MeetingDetail({ meetingId, onClose }: { meetingId: string; onClose: () => void }) {
  const { app } = useApp()
  const workspace = app.workspace
  const meeting = workspace?.meetings.find((item) => item.id === meetingId && !item.deleted)
  const [topic, setTopic] = useState(meeting?.topic ?? '')
  const [date, setDate] = useState(meeting?.date.value ?? '')
  const [start, setStart] = useState(meeting?.startTime.value ?? '')
  const [end, setEnd] = useState(meeting?.endTime.value ?? '')
  const [people, setPeople] = useState(meeting?.participants.join(', ') ?? '')
  const [saving, setSaving] = useState(false)
  if (!workspace || !meeting) return null

  const topics = new Map(workspace.meetings.map((item) => [item.id, item.topic]))
  const warnings = [
    meeting.awaitingScheduling && 'עדיין בלי מועד מתואם',
    meeting.weekdayMismatch && `היום שכתוב ("${meeting.weekdayWritten}") לא תואם לתאריך`,
    ...meeting.conflictsWith.map((id) => `חופפת ל"${topics.get(id) ?? 'פגישה אחרת'}"`),
  ].filter((text): text is string => typeof text === 'string')

  const changed =
    topic.trim() !== meeting.topic ||
    date !== (meeting.date.value ?? '') ||
    start !== (meeting.startTime.value ?? '') ||
    end !== (meeting.endTime.value ?? '') ||
    people.trim() !== meeting.participants.join(', ')

  async function save(button: HTMLButtonElement) {
    if (!meeting) return
    const patch: MeetingPatch = {}
    if (topic.trim() !== meeting.topic) patch.topic = topic.trim()
    if (date !== (meeting.date.value ?? '')) patch.date = date === '' ? null : date
    if (start !== (meeting.startTime.value ?? '')) patch.startTime = start === '' ? null : start
    if (end !== (meeting.endTime.value ?? '')) patch.endTime = end === '' ? null : end
    if (people.trim() !== meeting.participants.join(', ')) patch.participants = splitNames(people)
    if (Object.keys(patch).length === 0) return closeDialogOf(button)
    setSaving(true)
    const saved = await app.patchMeeting(meeting.id, patch)
    setSaving(false)
    if (saved) closeDialogOf(button)
  }

  const timeField = (label: string, value: string, set: (next: string) => void, field: typeof meeting.startTime) => (
    <label className="detail-field">
      {label} {field.value && <FactChip field={field} label={label} compact />}
      <span className="detail-row">
        <input type="time" dir="ltr" value={value} onChange={(event) => set(event.target.value)} />
        {value && (
          <button type="button" className="detail-clear" onClick={() => set('')}>
            ניקוי
          </button>
        )}
      </span>
    </label>
  )

  return (
    <DetailDialog
      kind="פגישה"
      title={meeting.topic}
      tone="purple"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="detail-danger"
            onClick={(event) => {
              void app.deleteMeeting(meeting.id)
              closeDialogOf(event.currentTarget)
            }}
          >
            מחיקה
          </button>
          <button type="button" className="detail-secondary" onClick={() => downloadIcs(`${meeting.topic}.ics`, buildIcs([meeting]))}>
            ייצוא ליומן
          </button>
          <span className="detail-spacer" />
          <button type="button" className="detail-secondary" onClick={(event) => closeDialogOf(event.currentTarget)}>
            ביטול
          </button>
          <button
            type="button"
            className="detail-primary"
            disabled={saving || topic.trim().length === 0 || !changed}
            onClick={(event) => void save(event.currentTarget)}
          >
            שמירה
          </button>
        </>
      }
    >
      <div className="detail-grid">
        <label className="detail-field detail-field-wide">
          נושא הפגישה
          <input value={topic} onChange={(event) => setTopic(event.target.value)} />
        </label>

        <label className="detail-field">
          תאריך {meeting.date.value && <FactChip field={meeting.date} label="תאריך" compact />}
          <span className="detail-row">
            <input type="date" dir="ltr" value={date} onChange={(event) => setDate(event.target.value)} />
            {date && (
              <button type="button" className="detail-clear" onClick={() => setDate('')}>
                ניקוי
              </button>
            )}
          </span>
        </label>

        <span />
        {timeField('שעת התחלה', start, setStart, meeting.startTime)}
        {timeField('שעת סיום', end, setEnd, meeting.endTime)}

        <label className="detail-field detail-field-wide">
          משתתפים (מופרדים בפסיקים)
          <input value={people} onChange={(event) => setPeople(event.target.value)} />
        </label>
      </div>

      {warnings.length > 0 && (
        <ul className="detail-reasons">
          {warnings.map((text) => (
            <li key={text} className="detail-warning">
              <WarningIcon size={15} />
              {text}
            </li>
          ))}
        </ul>
      )}

      <section className="detail-section">
        <h3>המקור בטקסט</h3>
        <SourceExcerpt field={meeting.quote} sources={workspace.sources} />
      </section>
    </DetailDialog>
  )
}
