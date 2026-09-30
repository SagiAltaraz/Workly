import type { Meeting } from '../types/meeting'
import type { Task } from '../types/task'
import { findMatches } from './commands/textMatch'

function candidatesOf(meetings: Meeting[]) {
  return meetings
    .filter((meeting) => !meeting.deleted)
    .map((meeting) => ({
      id: meeting.id,
      text: `${meeting.topic} ${meeting.quote.value ?? ''} ${meeting.participants.join(' ')}`,
      label: meeting.topic,
    }))
}

// Ties "prepare materials for the meeting with Sagi" to that meeting. A link is made only when the
// words fit exactly one meeting; two candidates, or none, leave the task unlinked rather than guessed.
// It runs on every recompute, so it works whichever arrives first, the task or the meeting.
export function linkTasksToMeetings(tasks: Task[], meetings: Meeting[]): Task[] {
  const candidates = candidatesOf(meetings)
  const liveIds = new Set(candidates.map((candidate) => candidate.id))

  return tasks.map((task) => {
    const link = task.meetingLink
    if (!link) return task
    if (link.meetingId && liveIds.has(link.meetingId)) return task

    const matches = findMatches(candidates, link.phrase)
    return { ...task, meetingLink: { ...link, meetingId: matches.length === 1 ? matches[0].id : null } }
  })
}
