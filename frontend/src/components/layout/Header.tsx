import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useToday } from '../../hooks/useToday'
import { formatShort, weekdayNames, weekdayIndex } from '../../utils/isoDate'
import { CalendarIcon, SparkleIcon, XIcon } from '../common/Icons'
import './Header.css'

const sections = [
  { id: 'tasks', label: 'משימות' },
  { id: 'meetings', label: 'פגישות' },
  { id: 'brief', label: 'בריף' },
]

interface HeaderProps {
  onOpenCalendar: () => void
}

function useActiveSection(): string {
  const [active, setActive] = useState('tasks')
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const line = window.innerHeight * 0.35
      let current = sections[0].id
      for (const { id } of sections) {
        const top = document.getElementById(id)?.getBoundingClientRect().top
        if (top !== undefined && top <= line) current = id
      }
      setActive(current)
    }
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])
  return active
}

export default function Header({ onOpenCalendar }: HeaderProps) {
  const { app } = useApp()
  const today = useToday()
  const active = useActiveSection()
  const picker = useRef<HTMLInputElement>(null)
  const workspace = app.workspace

  const reference = workspace?.referenceDate

  return (
    <header className="app-header">
      <nav className="app-nav" aria-label="ניווט ראשי">
        <a className="app-brand" href="#tasks">
          Workly
        </a>
        {sections.map((section) => (
          <a key={section.id} href={`#${section.id}`} className={active === section.id ? 'app-nav-active' : undefined} aria-current={active === section.id ? 'true' : undefined}>
            {section.label}
          </a>
        ))}
      </nav>

      <div className="app-header-meta">
        <span className="app-reference">
          {/* One date: today. Clicking it picks another date for the next text. */}
          <button
            type="button"
            className="app-reference-button"
            title="לחיצה בוחרת תאריך אחר, שממנו יחושבו היום ומחר בטקסט הבא"
            onClick={() => picker.current?.showPicker?.()}
          >
            יום {weekdayNames[weekdayIndex(today)]}, {formatShort(today)}
          </button>
          {/* Only said when the board is not on today: a text that named its own day, or a date picked by hand. */}
          {app.userReferenceDate ? (
            <>
              <span className="app-reference-note">הטקסט הבא יחושב לפי {formatShort(app.userReferenceDate)}</span>
              <button type="button" className="icon-button app-reference-clear" aria-label="ביטול בחירת תאריך" onClick={() => app.setUserReferenceDate(null)}>
                <XIcon size={14} />
              </button>
            </>
          ) : (
            reference &&
            reference !== today && <span className="app-reference-note">הלוח מציג את {formatShort(reference)} (לפי הטקסט)</span>
          )}
          <input
            ref={picker}
            type="date"
            className="visually-hidden"
            tabIndex={-1}
            aria-label="בחירת תאריך ייחוס"
            value={app.userReferenceDate ?? reference ?? today}
            onChange={(event) => app.setUserReferenceDate(event.target.value || null)}
          />
        </span>

        <button
          type="button"
          className={`header-demo-button${app.isDemo ? ' header-demo-button-active' : ''}`}
          disabled={app.demoLoading}
          title={app.isDemo ? 'חזרה למצב שלך' : 'טעינת דמו: שלושת הטקסטים של המטלה, דרך המודל האמיתי'}
          onClick={() => void app.toggleDemo()}
        >
          <SparkleIcon size={16} />
          {app.demoLoading ? 'טוען…' : app.isDemo ? 'יציאה מדמו' : 'דמו'}
        </button>

        <button type="button" className="header-calendar-button" onClick={onOpenCalendar}>
          <CalendarIcon size={17} />
          לוח שנה
        </button>
      </div>
    </header>
  )
}
