import { ValidationError } from '../../errors'
import type { ResolvedCommand } from '../../types/command'
import type { Workspace } from '../../types/workspace'
import {
  addMeeting,
  addTask,
  deleteMeeting,
  deleteTask,
  patchMeeting,
  patchTask,
  type Change,
  type MeetingPatch,
  type TaskPatch,
} from '../edits'

export const targetKind = {
  editTask: 'task',
  completeTask: 'task',
  reopenTask: 'task',
  deleteTask: 'task',
  unblockTask: 'task',
  editMeeting: 'meeting',
  deleteMeeting: 'meeting',
} as const

function requireTarget(targetId: string | null): string {
  if (!targetId) throw new ValidationError('חסר פריט יעד להוראה')
  return targetId
}

function taskPatchOf(command: ResolvedCommand): TaskPatch {
  return {
    ...(command.title !== null && { title: command.title }),
    ...(command.date !== null && { dueDate: command.date }),
    ...(command.startTime !== null && { dueTime: command.startTime }),
  }
}

function meetingPatchOf(command: ResolvedCommand): MeetingPatch {
  return {
    ...(command.title !== null && { topic: command.title }),
    ...(command.participants.length > 0 && { participants: command.participants }),
    ...(command.date !== null && { date: command.date }),
    ...(command.startTime !== null && { startTime: command.startTime }),
    ...(command.endTime !== null && { endTime: command.endTime }),
  }
}

// Every instruction ends in the same edit functions the cards use.
export function executeCommand(workspace: Workspace, command: ResolvedCommand, targetId: string | null): Change {
  switch (command.action) {
    case 'addTask':
      return addTask(workspace, {
        title: command.title ?? '',
        listedUnder: 'today',
        dueDate: command.date,
        dueTime: command.startTime,
      })
    case 'addMeeting':
      return addMeeting(workspace, {
        topic: command.title ?? '',
        date: command.date,
        startTime: command.startTime,
        endTime: command.endTime,
        participants: command.participants,
      })
    case 'editTask':
      return patchTask(workspace, requireTarget(targetId), taskPatchOf(command))
    case 'completeTask':
      return patchTask(workspace, requireTarget(targetId), { done: true })
    case 'reopenTask':
      return patchTask(workspace, requireTarget(targetId), { done: false })
    case 'unblockTask':
      return patchTask(workspace, requireTarget(targetId), { conditionResolved: true })
    case 'deleteTask':
      return deleteTask(workspace, requireTarget(targetId))
    case 'editMeeting':
      return patchMeeting(workspace, requireTarget(targetId), meetingPatchOf(command), { keepDuration: true })
    case 'deleteMeeting':
      return deleteMeeting(workspace, requireTarget(targetId))
  }
}
