import { useState } from 'react'
import type { TaskPatch } from '../../api/workspaceApi'
import { useApp } from '../../context/AppContext'
import { relativeLabel, todayInIsrael } from '../../utils/isoDate'
import { priorityLabel } from '../../utils/labels'
import { toneOfTask } from '../board/cardTone'
import FactChip from '../common/FactChip'
import SourceExcerpt from '../common/SourceExcerpt'
import { closeDialogOf } from './closeDialog'
import DetailDialog from './DetailDialog'

const waitLabels = { tomorrow: 'אפשר לדחות למחר', laterThisWeek: 'אפשר לדחות לסוף השבוע' } as const

export default function TaskDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { app } = useApp()
  const workspace = app.workspace
  const task = workspace?.tasks.find((item) => item.id === taskId && !item.deleted)
  const [title, setTitle] = useState(task?.title ?? '')
  const [date, setDate] = useState(task?.dueDate.value ?? '')
  const [time, setTime] = useState(task?.dueTime.value ?? '')
  const [done, setDone] = useState(task?.done ?? false)
  const [saving, setSaving] = useState(false)
  if (!workspace || !task) return null

  const meeting = task.deadline.meetingId ? workspace.meetings.find((item) => item.id === task.deadline.meetingId) : undefined
  const referenceDate = workspace.referenceDate ?? todayInIsrael()
  const signals: [string, string][] = [
    ['דחיפות בטקסט', task.signals.urgency],
    ['מישהו מחכה', task.signals.externalWaiting],
    ['חוסמת אחרות', task.signals.blocksOthers],
    ['תנאי', task.signals.condition],
    ['לא דחוף', task.signals.notUrgent],
    ['אפשר לדחות', task.signals.canWait ? waitLabels[task.signals.canWait] : null],
  ].filter((entry): entry is [string, string] => typeof entry[1] === 'string')

  const badge = task.done ? 'בוצעה' : task.blocked ? 'חסומה' : priorityLabel(task) || 'משימה'
  const changed = title.trim() !== task.title || date !== (task.dueDate.value ?? '') || time !== (task.dueTime.value ?? '') || done !== task.done

  async function save(event: HTMLButtonElement) {
    if (!task) return
    const patch: TaskPatch = {}
    if (title.trim() !== task.title) patch.title = title.trim()
    if (date !== (task.dueDate.value ?? '')) patch.dueDate = date === '' ? null : date
    if (time !== (task.dueTime.value ?? '')) patch.dueTime = time === '' ? null : time
    if (done !== task.done) patch.done = done
    if (Object.keys(patch).length === 0) return closeDialogOf(event)
    setSaving(true)
    const saved = await app.patchTask(task.id, patch)
    setSaving(false)
    if (saved) closeDialogOf(event)
  }

  return (
    <DetailDialog
      kind={badge}
      title={task.title}
      tone={toneOfTask(task)}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="detail-danger"
            onClick={(event) => {
              void app.deleteTask(task.id)
              closeDialogOf(event.currentTarget)
            }}
          >
            מחיקה
          </button>
          <span className="detail-spacer" />
          <button type="button" className="detail-secondary" onClick={(event) => closeDialogOf(event.currentTarget)}>
            ביטול
          </button>
          <button
            type="button"
            className="detail-primary"
            disabled={saving || title.trim().length === 0 || !changed}
            onClick={(event) => void save(event.currentTarget)}
          >
            שמירה
          </button>
        </>
      }
    >
      <div className="detail-grid">
        <label className="detail-field detail-field-wide">
          שם המשימה
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>

        <label className="detail-field">
          תאריך יעד {task.dueDate.value && <FactChip field={task.dueDate} label="תאריך יעד" compact />}
          <span className="detail-row">
            <input type="date" dir="ltr" value={date} onChange={(event) => setDate(event.target.value)} />
            {date && (
              <button type="button" className="detail-clear" onClick={() => setDate('')}>
                ניקוי
              </button>
            )}
          </span>
          {date === '' && task.deadline.date && meeting && (
            <span className="detail-hint">נגזר מהפגישה: {relativeLabel(task.deadline.date, referenceDate)}</span>
          )}
        </label>

        <label className="detail-field">
          שעת יעד {task.dueTime.value && <FactChip field={task.dueTime} label="שעת יעד" compact />}
          <span className="detail-row">
            <input type="time" dir="ltr" value={time} onChange={(event) => setTime(event.target.value)} />
            {time && (
              <button type="button" className="detail-clear" onClick={() => setTime('')}>
                ניקוי
              </button>
            )}
          </span>
          {time === '' && task.deadline.time && meeting && (
            <span className="detail-hint">נגזר מהפגישה: עד {task.deadline.time}</span>
          )}
        </label>

        <label className="detail-check detail-field-wide">
          <input type="checkbox" checked={done} onChange={(event) => setDone(event.target.checked)} />
          המשימה בוצעה
        </label>
      </div>

      {task.blocked && (
        <button
          type="button"
          className="detail-secondary"
          onClick={(event) => {
            void app.patchTask(task.id, { conditionResolved: true })
            closeDialogOf(event.currentTarget)
          }}
        >
          התנאי התקיים, לשחרר את המשימה
        </button>
      )}

      {!task.done && task.reason && (
        <section className="detail-section">
          <h3>למה זו העדיפות</h3>
          <ul className="detail-reasons">
            {task.reason.split(', ').map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>
      )}

      {(signals.length > 0 || meeting) && (
        <section className="detail-section">
          <h3>מה נאמר בטקסט</h3>
          <ul className="detail-signals">
            {meeting && (
              <li>
                <b>הכנה לפגישה</b>
                {meeting.topic}
                {meeting.startTime.value ? `, ${meeting.startTime.value}` : ''}
              </li>
            )}
            {signals.map(([label, value]) => (
              <li key={label}>
                <b>{label}</b>“{value}”
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="detail-section">
        <h3>המקור בטקסט</h3>
        <SourceExcerpt field={task.quote} sources={workspace.sources} />
      </section>
    </DetailDialog>
  )
}
