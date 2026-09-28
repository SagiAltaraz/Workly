import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useClock } from '../../hooks/useClock'
import { clockInIsrael, formatShort, todayInIsrael, weekdayNames, weekdayIndex } from '../../utils/isoDate'
import { CalendarIcon, XIcon } from '../common/Icons'
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
  const now = useClock()
  const active = useActiveSection()
  const picker = useRef<HTMLInputElement>(null)
  const today = todayInIsrael(now)
  const workspace = app.workspace

  const reference = workspace?.referenceDate
  const originLabel =
    workspace?.referenceDateOrigin === 'text' ? 'לפי הטקסט' : workspace?.referenceDateOrigin === 'user' ? 'לפי בחירה' : 'היום בישראל'

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
        <span className="app-clock">
          יום {weekdayNames[weekdayIndex(today)]}, {formatShort(today)} · {clockInIsrael(now)}
        </span>

        {reference && (
          <span className="app-reference">
            <button
              type="button"
              className="app-reference-button"
              title="תאריך הייחוס שממנו מחושבים היום ומחר. לחיצה בוחרת תאריך לטקסט הבא"
              onClick={() => picker.current?.showPicker?.()}
            >
              {app.userReferenceDate ? `בחירה שלך לטקסט הבא: ${formatShort(app.userReferenceDate)}` : `${originLabel}: ${formatShort(reference)}`}
            </button>
            {app.userReferenceDate && (
              <button type="button" className="icon-button app-reference-clear" aria-label="ביטול בחירת תאריך" onClick={() => app.setUserReferenceDate(null)}>
                <XIcon size={14} />
              </button>
            )}
            <input
              ref={picker}
              type="date"
              className="visually-hidden"
              tabIndex={-1}
              aria-label="בחירת תאריך ייחוס"
              value={app.userReferenceDate ?? reference}
              onChange={(event) => app.setUserReferenceDate(event.target.value || null)}
            />
          </span>
        )}

        <button type="button" className="header-calendar-button" onClick={onOpenCalendar}>
          <CalendarIcon size={17} />
          לוח שנה
        </button>
      </div>
    </header>
  )
}
