import { useApp, type EditRequest } from '../context/AppContext'
import type { BriefFieldKey, BriefItem } from '../types/brief'
import type { Meeting } from '../types/meeting'
import type { Task } from '../types/task'
import { briefDateKeys, briefFieldLabels } from '../utils/labels'

// The one place that knows what each editor asks and what saving it does, so a card, a question
// and the brief all open exactly the same editor for the same thing.
export function useEditRequests() {
  const { app, requestEdit } = useApp()
  const open = (request: EditRequest) => requestEdit(request)

  return {
    taskTitle: (task: Task) =>
      open({
        label: `שם המשימה`,
        currentValue: task.title,
        kind: 'text',
        hint: 'שינוי השם לא משנה את הציטוט מהטקסט המקורי.',
        save: (value) => app.patchTask(task.id, { title: value }),
      }),

    taskField: (task: Task, key: 'dueDate' | 'dueTime') =>
      open({
        label: `${task.title} · ${key === 'dueDate' ? 'תאריך יעד' : 'שעת יעד'}`,
        currentValue: task[key].value,
        kind: key === 'dueDate' ? 'date' : 'time',
        save: (value) => app.patchTask(task.id, { [key]: value }),
        clear: () => app.patchTask(task.id, { [key]: null }),
      }),

    meetingTopic: (meeting: Meeting) =>
      open({
        label: 'נושא הפגישה',
        currentValue: meeting.topic,
        kind: 'text',
        save: (value) => app.patchMeeting(meeting.id, { topic: value }),
      }),

    meetingParticipants: (meeting: Meeting) =>
      open({
        label: `${meeting.topic} · משתתפים`,
        currentValue: meeting.participants.join(', '),
        kind: 'text',
        hint: 'שמות מופרדים בפסיקים.',
        save: (value) =>
          app.patchMeeting(meeting.id, { participants: value.split(/[,،]/).map((name) => name.trim()).filter(Boolean) }),
      }),

    meetingField: (meeting: Meeting, key: 'date' | 'startTime' | 'endTime') => {
      const labels = { date: 'תאריך', startTime: 'שעת התחלה', endTime: 'שעת סיום' }
      return open({
        label: `${meeting.topic} · ${labels[key]}`,
        currentValue: meeting[key].value,
        kind: key === 'date' ? 'date' : 'time',
        save: (value) => app.patchMeeting(meeting.id, { [key]: value }),
        clear: () => app.patchMeeting(meeting.id, { [key]: null }),
      })
    },

    briefField: (key: BriefFieldKey, currentValue: string | null) =>
      open({
        label: briefFieldLabels[key],
        currentValue,
        kind: briefDateKeys.includes(key) ? 'date' : 'text',
        save: (value) => app.patchBriefField(key, value),
        clear: () => app.patchBriefField(key, null),
      }),

    briefItem: (item: BriefItem, noun: string) =>
      open({
        label: noun,
        currentValue: item.field.value,
        kind: 'text',
        save: (value) => app.editBriefItem(item.id, value),
      }),

    newBriefItem: (list: 'deliverables' | 'constraints') =>
      open({
        label: list === 'deliverables' ? 'תוצר חדש' : 'תנאי חדש',
        currentValue: null,
        kind: 'text',
        save: (value) => app.addBriefItem(list, value),
      }),

    missingDetail: (item: BriefItem) =>
      open({
        label: `מענה: ${item.field.value ?? ''}`,
        currentValue: null,
        kind: 'text',
        hint: 'התשובה תתווסף לתנאי הבריף.',
        save: (value) => app.answerMissingDetail(item.id, value),
      }),
  }
}
