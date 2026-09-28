import { flagMeetings } from './flagMeetings'
import { prioritizeTasks } from './prioritize'
import { deriveQuestions } from './questions'
import { todayInIsrael } from './dateMath'
import type { Workspace } from '../types/workspace'

// Everything computed from the workspace's facts. Runs after every change, so a user's
// edit or a contradiction answer is re-evaluated by the very same rules as fresh input.
export function recompute(workspace: Workspace, now: Date = new Date()): Workspace {
  const referenceDate = workspace.referenceDate ?? todayInIsrael(now)
  const next: Workspace = {
    ...workspace,
    tasks: prioritizeTasks(workspace.tasks, referenceDate),
    meetings: flagMeetings(workspace.meetings),
  }
  return { ...next, questions: deriveQuestions(next) }
}
