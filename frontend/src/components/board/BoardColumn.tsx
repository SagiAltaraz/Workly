import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { idOf, type BoardCard, type ColumnId } from '../../utils/buildBoard'
import { addDays } from '../../utils/isoDate'
import { columnTitles } from '../../utils/labels'
import { PlusIcon } from '../common/Icons'
import MeetingCard from './MeetingCard'
import { dropPosition } from './reorder'
import TaskCard from './TaskCard'
import './BoardColumn.css'

const dotColors: Record<ColumnId, string> = {
  today: 'var(--red)',
  tomorrow: 'var(--orange)',
  week: 'var(--amber)',
  blocked: 'var(--gray)',
  done: 'var(--green)',
  later: 'var(--primary)',
}

// What is being dragged. The board keeps it in state instead of in the drag event, because browsers
// differ on what they let a drop target read from a drag in progress.
export interface DragItem {
  kind: 'task' | 'meeting'
  id: string
}

interface BoardColumnProps {
  id: ColumnId
  description: string
  cards: BoardCard[]
  referenceDate: string
  meetingTopics: Map<string, string>
  dragging: DragItem | null
  onDragStart: (item: DragItem) => void
  onDragEnd: () => void
  onDropOn: (column: ColumnId) => void
  onReorder: (column: ColumnId, targetId: string, position: 'before' | 'after') => void
}

function AddTask({ column, referenceDate }: { column: 'today' | 'tomorrow' | 'week'; referenceDate: string }) {
  const { app } = useApp()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')

  async function submit() {
    const trimmed = title.trim()
    if (trimmed.length === 0) return
    // Tomorrow is a real date; today and the week are places the server understands.
    const placement =
      column === 'tomorrow'
        ? { listedUnder: 'week' as const, dueDate: addDays(referenceDate, 1) }
        : { listedUnder: column }
    if (await app.addTask({ title: trimmed, dueTime: null, ...placement })) {
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

export default function BoardColumn({
  id,
  description,
  cards,
  referenceDate,
  meetingTopics,
  dragging,
  onDragStart,
  onDragEnd,
  onDropOn,
  onReorder,
}: BoardColumnProps) {
  const [over, setOver] = useState(false)
  // Where a card dragged inside this column would land: before or after this card.
  const [landing, setLanding] = useState<{ id: string; position: 'before' | 'after' } | null>(null)
  const draggedHere = dragging !== null && cards.some((card) => idOf(card) === dragging.id)

  return (
    <section
      className={`board-column${dragging ? ' board-column-droppable' : ''}${over ? ' board-column-over' : ''}`}
      onDragOver={(event) => {
        if (!dragging) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={(event) => {
        // Moving over a card inside the column also fires a leave; only a real exit counts.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOver(false)
          setLanding(null)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        setLanding(null)
        if (dragging) onDropOn(id)
      }}
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
        {cards.map((card) => (
          <div
            key={idOf(card)}
            className={`board-slot${landing?.id === idOf(card) ? ` board-slot-${landing.position}` : ''}`}
            onDragOver={(event) => {
              if (!draggedHere || dragging?.id === idOf(card)) return
              event.preventDefault()
              event.stopPropagation()
              setOver(true)
              setLanding({ id: idOf(card), position: dropPosition(event) })
            }}
            onDrop={(event) => {
              if (!draggedHere || dragging?.id === idOf(card)) return
              event.preventDefault()
              event.stopPropagation()
              setOver(false)
              setLanding(null)
              onReorder(id, idOf(card), dropPosition(event))
            }}
          >
            {card.kind === 'task' ? (
              <TaskCard
                task={card.task}
                referenceDate={referenceDate}
                isDragged={dragging?.id === card.task.id}
                onDragStart={() => onDragStart({ kind: 'task', id: card.task.id })}
                onDragEnd={onDragEnd}
              />
            ) : (
              <MeetingCard
                meeting={card.meeting}
                referenceDate={referenceDate}
                otherTopics={meetingTopics}
                isDragged={dragging?.id === card.meeting.id}
                onDragStart={() => onDragStart({ kind: 'meeting', id: card.meeting.id })}
                onDragEnd={onDragEnd}
              />
            )}
          </div>
        ))}
        {(id === 'today' || id === 'tomorrow' || id === 'week') && <AddTask column={id} referenceDate={referenceDate} />}
      </div>
    </section>
  )
}
