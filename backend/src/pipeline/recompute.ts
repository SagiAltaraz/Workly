import { flagMeetings } from './flagMeetings'
import { linkTasksToMeetings } from './linkMeetings'
import { prioritizeTasks } from './prioritize'
import { deriveQuestions } from './questions'
import { todayInIsrael } from './dateMath'
import type { Workspace } from '../types/workspace'

// Everything computed from the workspace's facts. Runs after every change, so a user's
// edit or a contradiction answer is re-evaluated by the very same rules as fresh input.
export function recompute(workspace: Workspace, now: Date = new Date()): Workspace {
  const referenceDate = workspace.referenceDate ?? todayInIsrael(now)
  const meetings = flagMeetings(workspace.meetings)
  // Linking comes first: a task's deadline can come from the meeting it prepares for.
  const linked = linkTasksToMeetings(workspace.tasks, meetings)
  const next: Workspace = {
    ...workspace,
    meetings,
    tasks: prioritizeTasks(linked, referenceDate, meetings),
  }
  return { ...next, questions: deriveQuestions(next) }
}
