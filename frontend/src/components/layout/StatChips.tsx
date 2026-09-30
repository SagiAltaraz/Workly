import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { buildBoard } from '../../utils/buildBoard'
import './StatChips.css'

export default function StatChips() {
  const { app } = useApp()
  const workspace = app.workspace
  const board = useMemo(() => (workspace ? buildBoard(workspace) : null), [workspace])
  if (!workspace || !board) return null

  const chips = [
    { label: 'משימות להיום', count: board.today.filter((card) => card.kind === 'task').length, tone: 'blue', target: '#tasks' },
    { label: 'בהמשך', count: board.later.filter((card) => card.kind === 'task').length, tone: 'gray', target: '#tasks' },
    { label: 'חסומות', count: board.blocked.filter((card) => card.kind === 'task').length, tone: 'orange', target: '#tasks' },
    { label: 'פגישות היום', count: board.today.filter((card) => card.kind === 'meeting').length, tone: 'gray', target: '#meetings' },
    { label: 'שאלות לבירור', count: workspace.questions.length, tone: 'red', target: '#questions' },
  ]

  return (
    <ul className="stat-chips" aria-label="סיכום מהיר">
      {chips.map((chip) => (
        <li key={chip.label}>
          <a className="stat-chip" href={chip.target}>
            <span>{chip.label}</span>
            <b className={`stat-chip-count stat-chip-${chip.tone}`}>{chip.count}</b>
          </a>
        </li>
      ))}
    </ul>
  )
}
