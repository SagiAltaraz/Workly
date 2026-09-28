import { useApp } from '../../context/AppContext'
import './DeletedItems.css'

// Deleted tasks and meetings are only hidden. Here they can be brought back.
export default function DeletedItems() {
  const { app } = useApp()
  const workspace = app.workspace
  if (!workspace) return null

  const tasks = workspace.tasks.filter((task) => task.deleted)
  const meetings = workspace.meetings.filter((meeting) => meeting.deleted)
  if (tasks.length + meetings.length === 0) return null

  return (
    <details className="deleted-items">
      <summary>נמחקו ({tasks.length + meetings.length})</summary>
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            <span>משימה: {task.title}</span>
            <button type="button" onClick={() => void app.restoreTask(task.id)}>
              שחזור
            </button>
          </li>
        ))}
        {meetings.map((meeting) => (
          <li key={meeting.id}>
            <span>פגישה: {meeting.topic}</span>
            <button type="button" onClick={() => void app.restoreMeeting(meeting.id)}>
              שחזור
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}
