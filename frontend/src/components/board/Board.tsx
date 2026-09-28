import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { buildBoard, type ColumnId } from '../../utils/buildBoard'
import { formatShort, todayInIsrael } from '../../utils/isoDate'
import BoardColumn from './BoardColumn'
import DeletedItems from './DeletedItems'
import './Board.css'

export default function Board() {
  const { app } = useApp()
  const workspace = app.workspace
  const board = useMemo(() => (workspace ? buildBoard(workspace) : null), [workspace])
  if (!workspace || !board) return null

  const referenceDate = workspace.referenceDate ?? todayInIsrael()
  const descriptions: Record<ColumnId, string> = {
    today: `סדר העבודה לתאריך ${formatShort(referenceDate)}. דחיפות ודדליינים מחושבים בקוד.`,
    week: 'שבעת הימים הבאים מתאריך הייחוס.',
    blocked: 'חסום עד שתנאי מתקיים, או פגישה שעדיין מחכה לתיאום.',
    done: 'משימות שסומנו כבוצעו.',
    later: 'יותר משבוע קדימה, או בלי מועד.',
  }
  const meetingTopics = new Map(workspace.meetings.map((meeting) => [meeting.id, meeting.topic]))
  const columns: ColumnId[] = ['today', 'week', 'blocked', 'done', ...(board.later.length > 0 ? (['later'] as const) : [])]

  function onDropTask(taskId: string, column: ColumnId) {
    const task = workspace?.tasks.find((item) => item.id === taskId)
    if (!task) return
    if (column === 'done') {
      if (!task.done) void app.patchTask(taskId, { done: true })
    } else if (task.done) {
      void app.patchTask(taskId, { done: false })
    } else {
      app.showNotice('העמודה מחושבת מהטקסט. כדי להזיז משימה, אפשר לערוך את התאריך שלה מתפריט הכרטיס.')
    }
  }

  return (
    <section id="tasks" className="board" aria-label="לוח משימות">
      <div className="board-columns">
        {columns.map((id) => (
          <BoardColumn
            key={id}
            id={id}
            description={descriptions[id]}
            cards={board[id]}
            referenceDate={referenceDate}
            meetingTopics={meetingTopics}
            onDropTask={onDropTask}
          />
        ))}
      </div>
      <DeletedItems />
    </section>
  )
}
