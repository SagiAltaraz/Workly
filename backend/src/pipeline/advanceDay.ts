import type { Field } from '../types/provenance'
import type { Workspace } from '../types/workspace'
import { israelClock } from './dateMath'
import { recompute } from './recompute'

export interface Advanced {
  workspace: Workspace
  // Set when tasks were moved, so the move is written down and can be undone; null when only the date changed.
  label: string | null
}

// A board that follows the real clock moves on with it: the reference date becomes today, and a task
// that was for an earlier day and is not done is for today. Nothing is judged for a board that a text
// or a person pinned to a date of its own.
export function advanceDay(workspace: Workspace, now: Date): Advanced | null {
  const follows = workspace.referenceDateOrigin === 'today' || workspace.referenceDateOrigin === null
  const today = israelClock(now).date
  if (!follows) return null

  let moved = 0
  const tasks = workspace.tasks.map((task) => {
    const day = task.dueDate.value
    if (task.done || task.deleted || day === null || day >= today) return task
    moved += 1
    const carried: Field = {
      value: today,
      status: 'inferred',
      quote: task.quote.value,
      span: task.quote.span,
      verified: task.quote.verified,
      editedByUser: false,
      note: `לא הושלמה עד ${day}, ולכן עברה להיום`,
    }
    return { ...task, dueDate: carried }
  })

  const dateChanged = workspace.referenceDate !== null && workspace.referenceDate !== today
  if (moved === 0 && !dateChanged) return null
  const next = recompute({ ...workspace, referenceDate: workspace.referenceDate === null ? null : today, tasks }, now)
  return { workspace: next, label: moved > 0 ? `עברו להיום ${moved} משימות שלא הושלמו` : null }
}
