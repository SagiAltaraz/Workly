import type { DragEvent } from 'react'
import { useApp } from '../../context/AppContext'
import { useEditRequests } from '../../hooks/useEditRequests'
import type { Task } from '../../types/task'
import { priorityLabels } from '../../utils/labels'
import { relativeLabel } from '../../utils/isoDate'
import FactChip from '../common/FactChip'
import { CalendarIcon, ClockIcon, GripIcon } from '../common/Icons'
import Menu from '../common/Menu'
import QuoteBox from '../common/QuoteBox'
import { toneOfTask } from './cardTone'
import './Card.css'

interface TaskCardProps {
  task: Task
  referenceDate: string
}

export default function TaskCard({ task, referenceDate }: TaskCardProps) {
  const { app } = useApp()
  const edit = useEditRequests()
  const tone = toneOfTask(task)
  const badge = task.done ? 'בוצעה' : task.blocked ? 'חסומה' : task.priority ? priorityLabels[task.priority] : ''
  const reasons = task.reason.split(', ').filter((part) => part.length > 0)
  const date = task.dueDate.value
  const dateLabel = date ? relativeLabel(date, referenceDate) : task.signals.listedUnder === 'today' ? 'היום' : null
  const timeLabel = task.dueTime.value ? `עד ${task.dueTime.value}` : null

  function onDragStart(event: DragEvent<HTMLElement>) {
    event.dataTransfer.setData('text/x-workly-task', task.id)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <article className={`board-card tone-${tone}${task.done ? ' board-card-done' : ''}`} draggable onDragStart={onDragStart}>
      <header className="board-card-header">
        <span className="board-badge">{badge}</span>
        <div className="board-card-tools">
          <span className="board-card-grip" aria-hidden="true">
            <GripIcon size={16} />
          </span>
          <Menu
            items={[
              { label: task.done ? 'סימון כלא בוצעה' : 'סימון כבוצעה', onSelect: () => void app.patchTask(task.id, { done: !task.done }) },
              ...(task.blocked ? [{ label: 'התנאי התקיים, לשחרר', onSelect: () => void app.patchTask(task.id, { conditionResolved: true as const }) }] : []),
              { label: 'עריכת שם', onSelect: () => edit.taskTitle(task) },
              { label: 'עריכת תאריך יעד', onSelect: () => edit.taskField(task, 'dueDate') },
              { label: 'עריכת שעת יעד', onSelect: () => edit.taskField(task, 'dueTime') },
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
            {task.dueDate.value && <FactChip field={task.dueDate} label={`${task.title} · תאריך יעד`} compact />}
          </span>
        )}
        {timeLabel && (
          <span className="board-card-meta">
            <ClockIcon size={15} />
            {timeLabel}
            <FactChip field={task.dueTime} label={`${task.title} · שעת יעד`} compact />
          </span>
        )}
      </footer>
    </article>
  )
}
