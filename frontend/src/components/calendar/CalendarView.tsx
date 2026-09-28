import { useMemo, useState, type KeyboardEvent } from 'react'
import { useApp } from '../../context/AppContext'
import { useEditRequests } from '../../hooks/useEditRequests'
import type { Meeting } from '../../types/meeting'
import { monthGrid, shiftMonth } from '../../utils/calendarGrid'
import { buildIcs, downloadIcs } from '../../utils/ics'
import { timeRange } from '../../utils/meetingTime'
import { addDays, monthNames, partsOf, relativeLabel, todayInIsrael, weekdayAndDate, weekdayInitials } from '../../utils/isoDate'
import FactChip from '../common/FactChip'
import { XIcon, CalendarIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, DownloadIcon, PencilIcon, PlusIcon, WarningIcon } from '../common/Icons'
import MeetingFormDialog from './MeetingFormDialog'
import { meetingColor } from './meetingColor'
import './CalendarView.css'

function byTime(a: Meeting, b: Meeting): number {
  return (a.startTime.value ?? '99:99').localeCompare(b.startTime.value ?? '99:99')
}

interface CalendarViewProps {
  // Inside the header's calendar window: no collapsing, and no page anchor.
  embedded?: boolean
}

export default function CalendarView({ embedded = false }: CalendarViewProps) {
  const { app, showSource } = useApp()
  const edit = useEditRequests()
  const workspace = app.workspace
  const referenceDate = workspace?.referenceDate ?? todayInIsrael()
  const [cursor, setCursor] = useState(() => {
    const { year, month } = partsOf(referenceDate)
    return { year, month }
  })
  const [selected, setSelected] = useState(referenceDate)
  const [collapsed, setCollapsed] = useState(false)
  const [adding, setAdding] = useState(false)

  const byDate = useMemo(() => {
    const map = new Map<string, Meeting[]>()
    for (const meeting of (workspace?.meetings ?? []).filter((item) => !item.deleted)) {
      const date = meeting.date.value
      if (!date) continue
      map.set(date, [...(map.get(date) ?? []), meeting].sort(byTime))
    }
    return map
  }, [workspace?.meetings])

  if (!workspace) return null
  const monthMeetingCount = [...byDate.entries()].filter(([iso]) => iso.startsWith(`${cursor.year}-${String(cursor.month).padStart(2, '0')}`)).reduce((sum, [, list]) => sum + list.length, 0)
  const grid = monthGrid(cursor.year, cursor.month)
  const dayMeetings = byDate.get(selected) ?? []
  const liveMeetings = workspace.meetings.filter((meeting) => !meeting.deleted)
  const unscheduled = liveMeetings.filter((meeting) => meeting.date.value === null)
  const scheduled = liveMeetings.filter((meeting) => meeting.date.value && meeting.startTime.value)

  function select(iso: string) {
    setSelected(iso)
    const { year, month } = partsOf(iso)
    if (year !== cursor.year || month !== cursor.month) setCursor({ year, month })
  }

  // Arrow keys follow reading direction: in an RTL grid, right is the earlier day.
  function onKeyDown(event: KeyboardEvent) {
    const step = { ArrowRight: -1, ArrowLeft: 1, ArrowUp: -7, ArrowDown: 7 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    select(addDays(selected, step))
  }

  return (
    <section id={embedded ? undefined : 'meetings'} className={embedded ? 'calendar' : 'calendar card-surface'} aria-label="לוח פגישות">
      <header className="calendar-header">
        <button type="button" className="icon-button" aria-label="החודש הקודם" onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, -1))}>
          <ChevronRightIcon />
        </button>
        {embedded ? (
          <h2 className="calendar-title">
            {monthNames[cursor.month - 1]} {cursor.year}
          </h2>
        ) : (
          <button
            type="button"
            className="calendar-title calendar-title-toggle"
            aria-expanded={!collapsed}
            aria-controls="calendar-body"
            title={collapsed ? 'לחיצה תרחיב את הלוח' : 'לחיצה תצמצם את הלוח'}
            onClick={() => setCollapsed(!collapsed)}
          >
            <span>
              {monthNames[cursor.month - 1]} {cursor.year}
            </span>
            {collapsed && <span className="calendar-collapsed-count">{monthMeetingCount} פגישות בחודש</span>}
            <span className={`calendar-chevron${collapsed ? ' calendar-chevron-collapsed' : ''}`}>
              <ChevronDownIcon size={18} />
            </span>
          </button>
        )}
        <button type="button" className="icon-button" aria-label="החודש הבא" onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, 1))}>
          <ChevronLeftIcon />
        </button>
      </header>

      <div id={embedded ? undefined : 'calendar-body'} hidden={collapsed && !embedded}>
      <div className="calendar-grid" role="grid" aria-label={`${monthNames[cursor.month - 1]} ${cursor.year}`} onKeyDown={onKeyDown}>
        {weekdayInitials.map((initial) => (
          <div key={initial} className="calendar-weekday" role="columnheader">
            {initial}
          </div>
        ))}
        {grid.map((day) => {
          const meetings = byDate.get(day.iso) ?? []
          const classes = [
            'calendar-day',
            day.inMonth ? '' : 'calendar-day-outside',
            day.iso === referenceDate ? 'calendar-day-reference' : '',
            day.iso === selected ? 'calendar-day-selected' : '',
          ].join(' ')
          return (
            <button
              key={day.iso}
              type="button"
              role="gridcell"
              className={classes}
              aria-selected={day.iso === selected}
              aria-label={`${weekdayAndDate(day.iso)}${meetings.length ? `, ${meetings.length} פגישות` : ''}`}
              tabIndex={day.iso === selected ? 0 : -1}
              onClick={() => select(day.iso)}
            >
              <span>{partsOf(day.iso).day}</span>
              <span className="calendar-dots">
                {meetings.slice(0, 3).map((meeting) => (
                  <i key={meeting.id} style={{ background: meetingColor(meeting.id) }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      <div className="calendar-day-panel">
        <div className="calendar-day-title">
          <h3>{relativeLabel(selected, referenceDate)}</h3>
          <span>{dayMeetings.length} אירועים</span>
          <span className="calendar-day-date">{weekdayAndDate(selected)}</span>
        </div>

        {dayMeetings.length === 0 && <p className="calendar-empty">אין פגישות ביום הזה.</p>}
        <ul className="calendar-events">
          {dayMeetings.map((meeting) => {
            const warnings = [meeting.weekdayMismatch && 'היום שכתוב לא תואם לתאריך', meeting.conflictsWith.length > 0 && 'חופפת לפגישה אחרת'].filter(Boolean)
            return (
              <li key={meeting.id} className="calendar-event" style={{ '--event-color': meetingColor(meeting.id) } as React.CSSProperties}>
                <button type="button" className="calendar-event-main" onClick={() => showSource({ field: meeting.quote, label: `פגישה: ${meeting.topic}` })} title="הצג בטקסט המקור">
                  <strong>{meeting.topic}</strong>
                  <span className="calendar-event-time">
                    <ClockIcon size={14} />
                    {timeRange(meeting) ?? 'בלי שעה'}
                  </span>
                  {meeting.participants.length > 0 && <span className="calendar-event-with">עם {meeting.participants.join(', ')}</span>}
                  {warnings.length > 0 && (
                    <span className="calendar-event-warning">
                      <WarningIcon size={14} /> {warnings.join(' · ')}
                    </span>
                  )}
                </button>
                <FactChip field={meeting.startTime.value ? meeting.startTime : meeting.date} label={`${meeting.topic} · מועד`} compact />
                <button type="button" className="icon-button" aria-label="עריכת שעת התחלה" title="עריכת שעה" onClick={() => edit.meetingField(meeting, 'startTime')}>
                  <PencilIcon size={16} />
                </button>
                <button type="button" className="icon-button" aria-label="ייצוא ליומן" title="ייצוא ליומן (.ics)" onClick={() => downloadIcs(`${meeting.topic}.ics`, buildIcs([meeting]))}>
                  <DownloadIcon size={16} />
                </button>
                <button type="button" className="icon-button" aria-label="מחיקת הפגישה" title="מחיקה" onClick={() => void app.deleteMeeting(meeting.id)}>
                  <XIcon size={16} />
                </button>
              </li>
            )
          })}
        </ul>

        <button type="button" className="calendar-add" onClick={() => setAdding(true)}>
          <PlusIcon size={16} /> פגישה חדשה ביום הזה
        </button>

        {scheduled.length > 0 && (
          <button type="button" className="calendar-export" onClick={() => downloadIcs('workly-meetings.ics', buildIcs(scheduled))}>
            <CalendarIcon size={16} /> ייצוא כל הפגישות ליומן בטלפון (.ics)
          </button>
        )}
      </div>

      {unscheduled.length > 0 && (
        <div className="calendar-unscheduled">
          <h3>ממתינות לתיאום</h3>
          <ul>
            {unscheduled.map((meeting) => (
              <li key={meeting.id}>
                <span>{meeting.topic}</span>
                <button type="button" className="icon-button" aria-label="קביעת תאריך" onClick={() => edit.meetingField(meeting, 'date')}>
                  <PencilIcon size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
      {adding && <MeetingFormDialog initialDate={selected} onClose={() => setAdding(false)} />}
    </section>
  )
}
