import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useEditRequests } from '../../hooks/useEditRequests'
import { buildBoard, hasHour, idOf, meetingColumn, reorderedIds, taskColumn, type ColumnId } from '../../utils/buildBoard'
import { addDays, formatShort, todayInIsrael } from '../../utils/isoDate'
import BoardColumn, { type DragItem } from './BoardColumn'
import DeletedItems from './DeletedItems'
import './Board.css'

type Placement = 'today' | 'tomorrow' | 'week' | 'later'
const placements: ColumnId[] = ['today', 'tomorrow', 'week', 'later']

export default function Board() {
  const { app } = useApp()
  const edit = useEditRequests()
  const [dragging, setDragging] = useState<DragItem | null>(null)
  const workspace = app.workspace
  const board = useMemo(() => (workspace ? buildBoard(workspace) : null), [workspace])
  if (!workspace || !board) return null

  const referenceDate = workspace.referenceDate ?? todayInIsrael()
  const tomorrow = addDays(referenceDate, 1)
  const descriptions: Record<ColumnId, string> = {
    today: `סדר העבודה לתאריך ${formatShort(referenceDate)}. דחיפות ודדליינים מחושבים בקוד.`,
    tomorrow: `מחר, ${formatShort(tomorrow)}.`,
    week: 'מהיום שאחרי מחר ועד שבוע קדימה מתאריך הייחוס.',
    blocked: 'חסום עד שתנאי מתקיים, או פגישה שעדיין מחכה לתיאום.',
    done: 'משימות שסומנו כבוצעו.',
    later: 'יותר משבוע קדימה, או משימה שמחכה לפגישה שעוד לא נמצאה. אפשר לגרור אל היום, מחר או השבוע.',
  }
  const meetingTopics = new Map(workspace.meetings.map((meeting) => [meeting.id, meeting.topic]))
  // "Later" (no date yet) sits right after the week, where the eye is, and not at the far end.
  const columns: ColumnId[] = ['today', 'tomorrow', 'week', ...(board.later.length > 0 ? (['later'] as const) : []), 'blocked', 'done']

  function moveTask(taskId: string, target: ColumnId) {
    const task = workspace?.tasks.find((item) => item.id === taskId)
    if (!task || taskColumn(task) === target) return
    if (target === 'blocked') {
      app.showNotice('משימה חסומה רק כשיש לה תנאי שלא התקיים. אם התנאי התקיים, אפשר לשחרר אותה מתפריט הכרטיס.')
    } else if (target === 'done') {
      void app.moveTask(taskId, { done: true })
    } else {
      void app.moveTask(taskId, { ...(task.done && { done: false }), placement: target as Placement })
    }
  }

  function moveMeeting(meetingId: string, target: ColumnId) {
    const meeting = workspace?.meetings.find((item) => item.id === meetingId)
    if (!meeting || meetingColumn(meeting, referenceDate) === target) return
    if (target === 'today') void app.moveMeeting(meetingId, { date: referenceDate })
    else if (target === 'tomorrow') void app.moveMeeting(meetingId, { date: tomorrow })
    else if (target === 'week') edit.meetingField(meeting, 'date')
    else if (target === 'blocked') void app.moveMeeting(meetingId, { date: null })
    else app.showNotice('פגישה אפשר להעביר להיום, למחר, או לתאריך אחר דרך התפריט שלה.')
  }

  function onDropOn(column: ColumnId) {
    const item = dragging
    setDragging(null)
    if (!item || !placements.concat(['blocked', 'done']).includes(column)) return
    if (item.kind === 'task') moveTask(item.id, column)
    else moveMeeting(item.id, column)
  }

  // A card dropped before or after another in its own column. Only a card without an hour is the
  // person's to arrange; one with an hour sits where its hour puts it.
  function onReorder(column: ColumnId, targetId: string, position: 'before' | 'after') {
    const item = dragging
    setDragging(null)
    const cards = board?.[column]
    const dragged = cards?.find((card) => idOf(card) === item?.id)
    if (!item || !cards || !dragged) return
    if (hasHour(dragged)) {
      app.showNotice('כרטיס עם שעה ממוקם לפי השעה שלו. כדי להזיז אותו, שנו את השעה.')
      return
    }
    const ids = reorderedIds(cards, item.id, targetId, position, workspace?.cardOrder ?? [])
    if (ids) void app.orderCards(ids)
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
            dragging={dragging}
            onDragStart={setDragging}
            onDragEnd={() => setDragging(null)}
            onDropOn={onDropOn}
            onReorder={onReorder}
          />
        ))}
      </div>
      <DeletedItems />
    </section>
  )
}
