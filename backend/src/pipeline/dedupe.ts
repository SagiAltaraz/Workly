import type { Meeting } from '../types/meeting'
import type { Task } from '../types/task'
import { quoteOverlap } from './quoteMatching'

export const duplicateThreshold = 0.6

// One real-world commitment can be read as both a task and a meeting from the same
// sentence. The task already carries date, time and priority, so the meeting is dropped.
export function dedupeMeetingsAgainstTasks(
  meetings: Meeting[],
  tasks: Task[],
  threshold: number = duplicateThreshold,
): { kept: Meeting[]; dropped: Meeting[] } {
  const kept: Meeting[] = []
  const dropped: Meeting[] = []
  for (const meeting of meetings) {
    const duplicatesATask = tasks.some(
      (task) => quoteOverlap(meeting.quote.value ?? '', task.quote.value ?? '') >= threshold,
    )
    ;(duplicatesATask ? dropped : kept).push(meeting)
  }
  return { kept, dropped }
}
