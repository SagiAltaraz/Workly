import { useApp } from '../../context/AppContext'
import { useEditRequests } from '../../hooks/useEditRequests'
import type { Meeting } from '../../types/meeting'
import { buildIcs, downloadIcs } from '../../utils/ics'
import { timeRange } from '../../utils/meetingTime'
import { relativeLabel } from '../../utils/isoDate'
import FactChip from '../common/FactChip'
import { CalendarIcon, ClockIcon, WarningIcon } from '../common/Icons'
import Menu from '../common/Menu'
import QuoteBox from '../common/QuoteBox'
import './Card.css'

interface MeetingCardProps {
  meeting: Meeting
  referenceDate: string
  otherTopics: Map<string, string>
}

export default function MeetingCard({ meeting, referenceDate, otherTopics }: MeetingCardProps) {
  const { app } = useApp()
  const edit = useEditRequests()
  const range = timeRange(meeting)
  const date = meeting.date.value

  const warnings = [
    meeting.awaitingScheduling && 'עדיין בלי מועד מתואם',
    meeting.weekdayMismatch && `היום שכתוב ("${meeting.weekdayWritten}") לא תואם לתאריך`,
    ...meeting.conflictsWith.map((id) => `חופפת ל"${otherTopics.get(id) ?? 'פגישה אחרת'}"`),
  ].filter((text): text is string => typeof text === 'string')

  return (
    <article className="board-card tone-purple">
      <header className="board-card-header">
        <span className="board-badge">פגישה</span>
        <div className="board-card-tools">
          <Menu
            items={[
              { label: 'עריכת נושא', onSelect: () => edit.meetingTopic(meeting) },
              { label: 'עריכת משתתפים', onSelect: () => edit.meetingParticipants(meeting) },
              { label: 'עריכת תאריך', onSelect: () => edit.meetingField(meeting, 'date') },
              { label: 'עריכת שעת התחלה', onSelect: () => edit.meetingField(meeting, 'startTime') },
              { label: 'עריכת שעת סיום', onSelect: () => edit.meetingField(meeting, 'endTime') },
              { label: 'ייצוא ליומן (.ics)', onSelect: () => downloadIcs(`${meeting.topic}.ics`, buildIcs([meeting])) },
              { label: 'מחיקה', onSelect: () => void app.deleteMeeting(meeting.id) },
            ]}
          />
        </div>
      </header>

      <h3 className="board-card-title">{meeting.topic}</h3>
      {meeting.participants.length > 0 && <p className="board-card-sub">עם {meeting.participants.join(', ')}</p>}
      <QuoteBox field={meeting.quote} label={`פגישה: ${meeting.topic}`} />

      {warnings.length > 0 && (
        <ul className="board-card-warnings">
          {warnings.map((text) => (
            <li key={text}>
              <WarningIcon size={14} />
              {text}
            </li>
          ))}
        </ul>
      )}

      <footer className="board-card-footer">
        {date && (
          <span className="board-card-meta">
            <CalendarIcon size={15} />
            {relativeLabel(date, referenceDate)}
            <FactChip field={meeting.date} label={`${meeting.topic} · תאריך`} compact />
          </span>
        )}
        {range && (
          <span className="board-card-meta">
            <ClockIcon size={15} />
            {range}
            <FactChip field={meeting.startTime} label={`${meeting.topic} · שעה`} compact />
          </span>
        )}
      </footer>
    </article>
  )
}
