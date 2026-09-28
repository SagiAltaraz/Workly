import { useState, type DragEvent } from 'react'
import { useApp } from '../../context/AppContext'
import type { BoardCard } from '../../utils/buildBoard'
import type { ColumnId } from '../../utils/buildBoard'
import { columnTitles } from '../../utils/labels'
import { PlusIcon } from '../common/Icons'
import MeetingCard from './MeetingCard'
import TaskCard from './TaskCard'
import './BoardColumn.css'

const dotColors: Record<ColumnId, string> = {
  today: 'var(--red)',
  week: 'var(--orange)',
  blocked: 'var(--gray)',
  done: 'var(--green)',
  later: 'var(--primary)',
}

interface BoardColumnProps {
  id: ColumnId
  description: string
  cards: BoardCard[]
  referenceDate: string
  meetingTopics: Map<string, string>
  onDropTask: (taskId: string, column: ColumnId) => void
}

function AddTask({ column }: { column: 'today' | 'week' }) {
  const { app } = useApp()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')

  async function submit() {
    const trimmed = title.trim()
    if (trimmed.length === 0) return
    if (await app.addTask({ title: trimmed, listedUnder: column, dueTime: null })) {
      setTitle('')
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className="board-add" onClick={() => setOpen(true)}>
        משימה חדשה <PlusIcon size={16} />
      </button>
    )
  }
  return (
    <input
      className="board-add-input"
      value={title}
      placeholder="שם המשימה ו-Enter"
      autoFocus
      onChange={(event) => setTitle(event.target.value)}
      onBlur={() => !title.trim() && setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') void submit()
        if (event.key === 'Escape') setOpen(false)
      }}
    />
  )
}

export default function BoardColumn({ id, description, cards, referenceDate, meetingTopics, onDropTask }: BoardColumnProps) {
  const [over, setOver] = useState(false)

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setOver(false)
    const taskId = event.dataTransfer.getData('text/x-workly-task')
    if (taskId) onDropTask(taskId, id)
  }

  return (
    <section
      className={`board-column${over ? ' board-column-over' : ''}`}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('text/x-workly-task')) {
          event.preventDefault()
          setOver(true)
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <header className="board-column-header">
        <h3>
          <span className="board-column-dot" style={{ background: dotColors[id] }} />
          {columnTitles[id]}
          <span className="board-column-count">{cards.length}</span>
        </h3>
      </header>
      <p className="board-column-description">{description}</p>

      <div className="board-column-cards">
        {cards.length === 0 && <div className="board-column-empty">גררו לכאן כרטיסים</div>}
        {cards.map((card) =>
          card.kind === 'task' ? (
            <TaskCard key={card.task.id} task={card.task} referenceDate={referenceDate} />
          ) : (
            <MeetingCard key={card.meeting.id} meeting={card.meeting} referenceDate={referenceDate} otherTopics={meetingTopics} />
          ),
        )}
        {(id === 'today' || id === 'week') && <AddTask column={id} />}
      </div>
    </section>
  )
}
