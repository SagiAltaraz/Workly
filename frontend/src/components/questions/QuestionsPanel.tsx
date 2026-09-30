import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useEditRequests } from '../../hooks/useEditRequests'
import type { BriefFieldKey } from '../../types/brief'
import type { Question, QuestionKind } from '../../types/question'
import type { Workspace } from '../../types/workspace'
import { briefFieldLabels } from '../../utils/labels'
import { QuestionIcon, WarningIcon } from '../common/Icons'
import './QuestionsPanel.css'

const initiallyVisible = 3

const kindLabels: Record<QuestionKind, string> = {
  missingField: 'חסר מידע',
  unresolvedValue: 'ערך לא ברור',
  unverifiedQuote: 'לא אומת מול הטקסט',
  weekdayMismatch: 'יום ותאריך לא תואמים',
  awaitingScheduling: 'ממתינה לתיאום',
  meetingConflict: 'חפיפה בין פגישות',
  contradiction: 'סתירה בין טקסטים',
}

const briefKeys = Object.keys(briefFieldLabels) as BriefFieldKey[]

interface Answer {
  label: string
  run: () => void
}

// What a person can do to close a question, when there is something to do.
function answerFor(question: Question, workspace: Workspace, edit: ReturnType<typeof useEditRequests>): Answer | null {
  const field = question.field
  if (!field) return null

  if (question.targetType === 'brief') {
    const brief = workspace.briefs.find((item) => item.id === question.targetId)
    if (!brief) return null
    if (briefKeys.includes(field as BriefFieldKey)) {
      const key = field as BriefFieldKey
      const current = brief.fields[key].value
      return { label: current ? 'תיקון' : 'השלמה', run: () => edit.briefField(brief.id, key, current) }
    }
    if (field.startsWith('missingDetail:')) {
      const item = brief.missingDetails.find((entry) => entry.id === field.slice('missingDetail:'.length))
      return item ? { label: 'מענה', run: () => edit.missingDetail(item) } : null
    }
    return null
  }

  const id = question.targetId
  if (question.targetType === 'task' && id && (field === 'dueDate' || field === 'dueTime')) {
    const task = workspace.tasks.find((item) => item.id === id)
    return task ? { label: task[field].value ? 'תיקון' : 'השלמה', run: () => edit.taskField(task, field) } : null
  }

  if (question.targetType === 'meeting' && id) {
    const meeting = workspace.meetings.find((item) => item.id === id)
    if (!meeting) return null
    // Weekday, schedule and conflict questions are all answered by fixing the date, or the time.
    const needsTime = field === 'startTime' || (field === 'schedule' && meeting.date.value !== null) || question.kind === 'meetingConflict'
    const key = needsTime ? 'startTime' : 'date'
    return { label: meeting[key].value ? 'תיקון' : 'השלמה', run: () => edit.meetingField(meeting, key) }
  }
  return null
}

export default function QuestionsPanel() {
  const { app } = useApp()
  const edit = useEditRequests()
  const [showAll, setShowAll] = useState(false)
  const workspace = app.workspace
  if (!workspace || workspace.questions.length === 0) return null

  const questions = showAll ? workspace.questions : workspace.questions.slice(0, initiallyVisible)

  return (
    <section id="questions" className="questions card-surface" aria-label="שאלות לבירור">
      <header className="questions-header">
        <h2 className="section-title">
          <QuestionIcon size={22} /> שאלות לבירור
        </h2>
        <span className="questions-count">{workspace.questions.length}</span>
        <p>מידע שחסר או לא ברור. המערכת לא ממציאה תשובות, אלא שואלת.</p>
      </header>

      <ul className="questions-list">
        {questions.map((question) => {
          const answer = answerFor(question, workspace, edit)
          return (
            <li key={question.id} className={`question question-${question.kind}`}>
              <span className="question-icon">{question.kind === 'contradiction' ? <WarningIcon size={18} /> : <QuestionIcon size={18} />}</span>
              <div className="question-body">
                <p>
                  <span className="question-kind">{kindLabels[question.kind]}</span> {question.text}
                </p>
                {question.candidates && (
                  <div className="question-choices">
                    <button type="button" onClick={() => void app.resolveContradiction(question.id, 'keepExisting')}>
                      להשאיר: {question.candidates.existing}
                    </button>
                    <button type="button" onClick={() => void app.resolveContradiction(question.id, 'useIncoming')}>
                      לעדכן ל: {question.candidates.incoming}
                    </button>
                  </div>
                )}
              </div>
              {answer && !question.candidates && (
                <button type="button" className="question-action" onClick={answer.run}>
                  {answer.label}
                </button>
              )}
              {!question.candidates && (
                <button type="button" className="question-action question-dismiss" title="הסתרת השאלה" onClick={() => void app.dismissQuestion(question.id)}>
                  התעלם
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {workspace.questions.length > initiallyVisible && (
        <button type="button" className="questions-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'הצג פחות' : `הצג עוד ${workspace.questions.length - initiallyVisible}`}
        </button>
      )}
    </section>
  )
}
