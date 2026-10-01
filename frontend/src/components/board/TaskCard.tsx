import { useApp } from '../../context/AppContext'
import { useEditRequests } from '../../hooks/useEditRequests'
import type { Task } from '../../types/task'
import { buildTaskIcs, downloadIcs } from '../../utils/ics'
import { dayPartLabels, priorityLabel } from '../../utils/labels'
import { relativeLabel } from '../../utils/isoDate'
import FactChip from '../common/FactChip'
import { CalendarIcon, ClockIcon, GripIcon } from '../common/Icons'
import Menu from '../common/Menu'
import QuoteBox from '../common/QuoteBox'
import { dragProps } from './cardDrag'
import { openProps } from './cardOpen'
import { toneOfTask } from './cardTone'
import './Card.css'

interface TaskCardProps {
  task: Task
  referenceDate: string
  isDragged: boolean
  onDragStart: () => void
  onDragEnd: () => void
}

export default function TaskCard({ task, referenceDate, isDragged, onDragStart, onDragEnd }: TaskCardProps) {
  const { app, openDetail } = useApp()
  const edit = useEditRequests()
  const tone = toneOfTask(task)
  const badge = task.done ? 'בוצעה' : task.blocked ? 'חסומה' : priorityLabel(task)
  const reasons = task.reason.split(', ').filter((part) => part.length > 0)
  // The deadline is the task's own, or its meeting's when the task states none.
  const date = task.deadline.date ?? task.dueDate.value
  const time = task.deadline.time ?? task.dueTime.value
  const dateLabel = date ? relativeLabel(date, referenceDate) : task.signals.listedUnder === 'today' ? 'היום' : null
  const timeLabel = time ? `עד ${time}` : null
  const dateFromMeeting = task.deadline.meetingId !== null && task.dueDate.value === null && date !== null
  const timeFromMeeting = task.deadline.meetingId !== null && task.dueTime.value === null && time !== null
  const fromMeeting = <span className="fact-chip fact-chip-inferred fact-chip-compact" title="נגזר מהפגישה שהמשימה מכינה אליה">מהפגישה</span>

  return (
    <article
      className={`board-card tone-${tone}${task.done ? ' board-card-done' : ''}${isDragged ? ' board-card-dragging' : ''}`}
      {...dragProps(task.id, onDragStart, onDragEnd)}
      {...openProps(() => openDetail({ kind: 'task', id: task.id }))}
    >
      <header className="board-card-header">
        <span className="board-badge">{badge}</span>
        <div className="board-card-tools">
          <span className="board-card-grip" aria-hidden="true">
            <GripIcon size={16} />
          </span>
          <Menu
            items={[
              { label: 'פתיחה והרחבה', onSelect: () => openDetail({ kind: 'task', id: task.id }) },
              { label: task.done ? 'סימון כלא בוצעה' : 'סימון כבוצעה', onSelect: () => void app.patchTask(task.id, { done: !task.done }) },
              ...(task.blocked ? [{ label: 'התנאי התקיים, לשחרר', onSelect: () => void app.patchTask(task.id, { conditionResolved: true as const }) }] : []),
              { label: 'עריכת שם', onSelect: () => edit.taskTitle(task) },
              { label: 'עריכת תאריך יעד', onSelect: () => edit.taskField(task, 'dueDate') },
              { label: 'עריכת שעת יעד', onSelect: () => edit.taskField(task, 'dueTime') },
              ...(date ? [{ label: 'ייצוא ליומן (.ics)', onSelect: () => downloadIcs(`${task.title}.ics`, buildTaskIcs([task])) }] : []),
              { label: 'מחיקה', onSelect: () => void app.deleteTask(task.id) },
            ]}
          />
        </div>
      </header>

      <h3 className="board-card-title">{task.title}</h3>
      <QuoteBox field={task.quote} label={`משימה: ${task.title}`} />

      {reasons.length > 0 && !task.done && (
        <ul className="board-card-reasons">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      <footer className="board-card-footer">
        {dateLabel && (
          <span className="board-card-meta">
            <CalendarIcon size={15} />
            {dateLabel}
            {dateFromMeeting
              ? fromMeeting
              : task.dueDate.value && <FactChip field={task.dueDate} label={`${task.title} · תאריך יעד`} compact />}
          </span>
        )}
        {!timeLabel && task.signals.dayPart && (
          <span className="board-card-meta" title="חלק מהיום, בלי שעה מדויקת">
            <ClockIcon size={15} />
            {dayPartLabels[task.signals.dayPart]}
          </span>
        )}
        {timeLabel && (
          <span className="board-card-meta">
            <ClockIcon size={15} />
            {timeLabel}
            {timeFromMeeting ? fromMeeting : <FactChip field={task.dueTime} label={`${task.title} · שעת יעד`} compact />}
          </span>
        )}
      </footer>
    </article>
  )
}
