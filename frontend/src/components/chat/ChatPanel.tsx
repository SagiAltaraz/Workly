import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { ArrowUpIcon, ChevronDownIcon, RefreshIcon, SparkleIcon } from '../common/Icons'
import StageProgress from './StageProgress'
import './ChatPanel.css'

const longMessage = 220

function UserMessage({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > longMessage
  return (
    <div className="chat-bubble chat-bubble-user">
      <p className={isLong && !expanded ? 'chat-clamped' : undefined}>{text}</p>
      {isLong && (
        <button type="button" className="chat-expand" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'הצג פחות' : 'הצג הכל'}
        </button>
      )}
    </div>
  )
}

interface ChatPanelProps {
  minimized: boolean
  onToggleMinimized: () => void
}

export default function ChatPanel({ minimized, onToggleMinimized }: ChatPanelProps) {
  const { app } = useApp()
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const { workspace, running, stages, runError, modelConfigured, resumed, commandResults } = app
  const lastActivity = workspace?.activity.at(-1)
  const hasProgress = running || Object.keys(stages).length > 0

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [workspace?.sources.length, workspace?.activity.length, stages, runError, running, commandResults])

  async function send() {
    const text = draft.trim()
    if (text.length === 0 || running) return
    setDraft('')
    await app.analyze(text)
  }

  return (
    <aside className={`chat card-surface${minimized ? ' chat-minimized' : ''}`} aria-label="AI Chat">
      <header className="chat-header" onClick={minimized ? onToggleMinimized : undefined}>
        <span className="chat-header-icon">
          <SparkleIcon size={20} />
        </span>
        <h2 className="chat-title">AI Chat</h2>
        {minimized && running && <span className="chat-status">מעבד…</span>}
        {!minimized && (
          <button
            type="button"
            className="icon-button"
            aria-label="התחלה מחדש"
            title="התחלה מחדש (workspace חדש)"
            disabled={running}
            onClick={() => {
              if (window.confirm('להתחיל workspace חדש? המצב הנוכחי נשמר אצלנו, אבל לא יוצג יותר.')) void app.startOver()
            }}
          >
            <RefreshIcon />
          </button>
        )}
        <button
          type="button"
          className={`icon-button chat-minimize${minimized ? ' chat-minimize-restore' : ''}`}
          aria-label={minimized ? 'פתיחת הצ׳אט' : 'מזעור הצ׳אט'}
          aria-expanded={!minimized}
          title={minimized ? 'פתיחת הצ׳אט' : 'מזעור הצ׳אט'}
          onClick={(event) => {
            event.stopPropagation()
            onToggleMinimized()
          }}
        >
          <ChevronDownIcon />
        </button>
      </header>

      <div className="chat-messages">
        <div className="chat-bubble chat-bubble-system">
          <p>{resumed ? 'חובר לשרת. המשכתי מהמצב הקיים מהפעם הקודמת.' : 'חובר לשרת. הדביקו כאן בריף, רשימת משימות או פגישות, והמערכת תארגן אותם.'}</p>
          <p className="chat-tip">אפשר גם לתת הוראות, למשל: &quot;הפגישה עם הלקוח עברה ל-11:00&quot;, &quot;תמחק את המשימה לסדר את התיקייה&quot;, &quot;התקבל אישור הקריאייטיב&quot;.</p>
        </div>

        {!modelConfigured && (
          <div className="chat-bubble chat-bubble-warning">
            <p>לא הוגדר מודל (חסר OPENAI_API_KEY), ולכן אי אפשר לחלץ מידע מטקסט חדש. אפשר להוסיף את המפתח לקובץ .env ולהפעיל מחדש.</p>
          </div>
        )}

        {workspace?.sources.map((source) => <UserMessage key={source.id} text={source.text} />)}

        {hasProgress && (
          <div className="chat-bubble chat-bubble-system">
            <StageProgress stages={stages} running={running} />
          </div>
        )}

        {commandResults.map((result, index) => (
          <div key={`${result.message}-${index}`} className={`chat-bubble ${result.status === 'applied' ? 'chat-bubble-applied' : 'chat-bubble-warning'}`}>
            <p>{result.status === 'applied' ? `בוצע: ${result.message}` : result.message}</p>
            {result.status === 'needsChoice' && (
              <div className="chat-choices">
                {result.choices.map((choice) => (
                  <button key={choice.targetId} type="button" onClick={() => void app.chooseCommandTarget(result, choice.targetId)}>
                    {choice.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {lastActivity && !running && (
          <div className="chat-bubble chat-activity">
            <span>הפעולה האחרונה: {lastActivity.label}</span>
            <button type="button" className="chat-undo" onClick={() => void app.undo()}>
              ביטול
            </button>
          </div>
        )}

        {runError && (
          <div className="chat-bubble chat-bubble-warning">
            <p>{runError}</p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <textarea
          value={draft}
          rows={3}
          placeholder="הדביקו טקסט, או כתבו הוראה: הפגישה עם הלקוח עברה ל-11:00…"
          aria-label="טקסט לעיבוד"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void send()
            }
          }}
        />
        <div className="chat-composer-footer">
          <span className="chat-hint">Enter לשליחה, Shift+Enter לשורה חדשה</span>
          <button type="submit" className="chat-send" aria-label="שליחה" disabled={running || draft.trim().length === 0}>
            <ArrowUpIcon size={18} />
          </button>
        </div>
      </form>
    </aside>
  )
}
