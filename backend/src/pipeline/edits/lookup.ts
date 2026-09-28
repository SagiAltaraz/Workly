import { NotFoundError } from '../../errors'
import type { Meeting } from '../../types/meeting'
import type { Task } from '../../types/task'
import type { FieldTarget, Workspace } from '../../types/workspace'

export function requireTask(workspace: Workspace, id: string): Task {
  const task = workspace.tasks.find((item) => item.id === id)
  if (!task) throw new NotFoundError('המשימה לא נמצאה')
  return task
}

export function requireMeeting(workspace: Workspace, id: string): Meeting {
  const meeting = workspace.meetings.find((item) => item.id === id)
  if (!meeting) throw new NotFoundError('הפגישה לא נמצאה')
  return meeting
}

export function replaceTask(workspace: Workspace, task: Task): Workspace {
  return { ...workspace, tasks: workspace.tasks.map((item) => (item.id === task.id ? task : item)) }
}

export function replaceMeeting(workspace: Workspace, meeting: Meeting): Workspace {
  return { ...workspace, meetings: workspace.meetings.map((item) => (item.id === meeting.id ? meeting : item)) }
}

// A change to a field settles any open contradiction about that field.
export function dropContradictions(workspace: Workspace, type: 'task' | 'meeting', id: string, keys: string[]): Workspace {
  const settled = (target: FieldTarget) => target.type === type && 'id' in target && target.id === id && keys.includes(target.key)
  return { ...workspace, contradictions: workspace.contradictions.filter((item) => !settled(item.target)) }
}
