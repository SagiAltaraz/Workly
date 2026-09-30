import type { Meeting } from '../types/meeting'
import type { Task } from '../types/task'
import { quoteOverlap } from './quoteMatching'

export const duplicateThreshold = 0.6

export interface Collapsed {
  meetings: Meeting[]
  tasks: Task[]
  droppedMeetings: number
  droppedTasks: number
}

// A task that says more than "this meeting exists": urgency, a condition, a link to a meeting.
function carriesMoreThanTheMeeting(task: Task): boolean {
  const { urgency, externalWaiting, blocksOthers, condition, canWait, notUrgent } = task.signals
  return [urgency, externalWaiting, blocksOthers, condition, canWait, notUrgent, task.meetingLink].some(Boolean)
}

// Two agents can claim the same sentence, one as a task and one as a meeting. The evidence decides:
// - the meeting has a time: it is a real appointment, so it goes on the calendar and the plain task
//   that repeats it is dropped (a task that adds urgency or a condition is kept);
// - the meeting has no time: a "meeting" that only overlaps a to-do is a to-do read as a meeting,
//   so the meeting is dropped and the task stays.
export function collapseOverlappingClaims(
  meetings: Meeting[],
  tasks: Task[],
  threshold: number = duplicateThreshold,
): Collapsed {
  const droppedTaskIds = new Set<string>()
  const keptMeetings: Meeting[] = []
  let droppedMeetings = 0

  for (const meeting of meetings) {
    const overlapping = tasks.filter(
      (task) => quoteOverlap(meeting.quote.value ?? '', task.quote.value ?? '') >= threshold,
    )
    if (overlapping.length === 0) {
      keptMeetings.push(meeting)
    } else if (meeting.startTime.value !== null) {
      keptMeetings.push(meeting)
      for (const task of overlapping) if (!carriesMoreThanTheMeeting(task)) droppedTaskIds.add(task.id)
    } else {
      droppedMeetings += 1
    }
  }

  return {
    meetings: keptMeetings,
    tasks: tasks.filter((task) => !droppedTaskIds.has(task.id)),
    droppedMeetings,
    droppedTasks: droppedTaskIds.size,
  }
}
