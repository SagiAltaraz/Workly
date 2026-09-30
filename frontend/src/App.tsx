import { useEffect, useMemo, useState } from 'react'
import './App.css'
import BriefView from './components/brief/BriefView'
import Board from './components/board/Board'
import CalendarDialog from './components/calendar/CalendarDialog'
import CalendarView from './components/calendar/CalendarView'
import ChatPanel from './components/chat/ChatPanel'
import FieldEditDialog from './components/common/FieldEditDialog'
import SourceDialog from './components/common/SourceDialog'
import MeetingDetail from './components/detail/MeetingDetail'
import TaskDetail from './components/detail/TaskDetail'
import Header from './components/layout/Header'
import StatChips from './components/layout/StatChips'
import QuestionsPanel from './components/questions/QuestionsPanel'
import { AppContext, type AppContextValue, type DetailRequest, type EditRequest, type SourceRequest } from './context/AppContext'
import { useWorkspace } from './hooks/useWorkspace'

export default function App() {
  const app = useWorkspace()
  const [source, setSource] = useState<SourceRequest | null>(null)
  const [edit, setEdit] = useState<EditRequest | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [detail, setDetail] = useState<DetailRequest | null>(null)
  const [chatMinimized, setChatMinimized] = useState(false)

  const context = useMemo<AppContextValue>(
    () => ({ app, showSource: setSource, requestEdit: setEdit, openDetail: setDetail }),
    [app],
  )

  useEffect(() => {
    if (!app.notice) return
    const timer = setTimeout(app.dismissNotice, app.notice.undoable ? 10_000 : 6000)
    return () => clearTimeout(timer)
  }, [app.notice, app.dismissNotice])

  if (app.phase === 'loading') return <p className="app-status">טוען…</p>
  if (app.phase === 'failed') {
    return (
      <div className="app-status app-status-error">
        <h1>אין חיבור לשרת</h1>
        <p>{app.bootError}</p>
        <p>לוודא שהשרת רץ: docker compose up, או npm start בתיקיית backend.</p>
      </div>
    )
  }

  return (
    <AppContext.Provider value={context}>
      <Header onOpenCalendar={() => setCalendarOpen(true)} />
      <div className={`app-shell${chatMinimized ? ' app-shell-chat-minimized' : ''}`}>
        <ChatPanel minimized={chatMinimized} onToggleMinimized={() => setChatMinimized(!chatMinimized)} />
        <main className="app-content">
          <StatChips />
          <QuestionsPanel />
          <Board />
          <CalendarView />
          <BriefView />
        </main>
      </div>

      {detail?.kind === 'task' && <TaskDetail key={detail.id} taskId={detail.id} onClose={() => setDetail(null)} />}
      {detail?.kind === 'meeting' && <MeetingDetail key={detail.id} meetingId={detail.id} onClose={() => setDetail(null)} />}
      {calendarOpen && <CalendarDialog onClose={() => setCalendarOpen(false)} />}
      {source && <SourceDialog request={source} sources={app.workspace?.sources ?? []} onClose={() => setSource(null)} />}
      {edit && <FieldEditDialog request={edit} onClose={() => setEdit(null)} />}
      {app.notice && (
        <div className="app-notice" role="status">
          <span>{app.notice.text}</span>
          {app.notice.undoable && (
            <button type="button" className="app-notice-undo" onClick={() => void app.undo()}>
              ביטול
            </button>
          )}
          <button type="button" className="app-notice-close" aria-label="סגירה" onClick={app.dismissNotice}>
            ×
          </button>
        </div>
      )}
    </AppContext.Provider>
  )
}
