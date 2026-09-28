import { ValidationError } from '../../errors'
import type { CommandChoice, CommandResult, ResolvedCommand } from '../../types/command'
import type { Workspace } from '../../types/workspace'
import { executeCommand, targetKind } from './executeCommand'
import type { ParsedCommand } from './parseCommand'
import { findMatches, type Candidate } from './textMatch'

export interface AppliedCommands {
  workspace: Workspace
  results: CommandResult[]
  // What actually changed, in words, for the activity line.
  labels: string[]
}

const maxChoices = 5

function taskCandidates(workspace: Workspace, action: ResolvedCommand['action']): Candidate[] {
  return workspace.tasks
    .filter((task) => !task.deleted)
    .filter((task) => (action === 'completeTask' ? !task.done : action === 'reopenTask' ? task.done : true))
    .filter((task) => (action === 'unblockTask' ? task.blocked : true))
    .map((task) => ({
      id: task.id,
      // A condition that happened is matched against the condition each task waits for.
      text: action === 'unblockTask' ? (task.signals.condition ?? '') : `${task.title} ${task.quote.value ?? ''}`,
      label: [task.title, task.dueDate.value].filter(Boolean).join(' · '),
    }))
}

function meetingCandidates(workspace: Workspace): Candidate[] {
  return workspace.meetings
    .filter((meeting) => !meeting.deleted)
    .map((meeting) => ({
      id: meeting.id,
      text: `${meeting.topic} ${meeting.quote.value ?? ''} ${meeting.participants.join(' ')}`,
      label: [meeting.topic, meeting.date.value, meeting.startTime.value].filter(Boolean).join(' · '),
    }))
}

function result(status: CommandResult['status'], message: string, command: ResolvedCommand | null, choices: CommandChoice[] = []): CommandResult {
  return { status, message, command, choices }
}

// Runs the instructions one after the other. A target is only acted on when exactly one item
// clearly matches the words used; otherwise the person is asked, and nothing is guessed.
export function applyCommands(start: Workspace, parsed: ParsedCommand[]): AppliedCommands {
  let workspace = start
  const results: CommandResult[] = []
  const labels: string[] = []

  for (const entry of parsed) {
    if (!entry.ok) {
      if (!entry.ignored) results.push(result('invalid', entry.message, null))
      continue
    }
    const { command, targetText } = entry

    try {
      const kind = targetKind[command.action as keyof typeof targetKind]
      if (!kind) {
        const change = executeCommand(workspace, command, null)
        workspace = change.workspace
        labels.push(change.label)
        results.push(result('applied', change.label, command))
        continue
      }

      const candidates = kind === 'task' ? taskCandidates(workspace, command.action) : meetingCandidates(workspace)
      const matches = findMatches(candidates, targetText ?? '')
      const noun = kind === 'task' ? 'משימה' : 'פגישה'

      if (matches.length === 0) {
        results.push(result('notFound', `לא מצאתי ${noun} שמתאימה ל"${targetText}".`, command))
        continue
      }

      // A condition that happened frees every task that was waiting for it.
      const targets = command.action === 'unblockTask' || matches.length === 1 ? matches : []
      if (targets.length === 0) {
        results.push(
          result(
            'needsChoice',
            `לאיזו ${noun} התכוונת ב"${command.quote}"?`,
            command,
            matches.slice(0, maxChoices).map((match) => ({ targetId: match.id, label: match.label })),
          ),
        )
        continue
      }

      const messages: string[] = []
      for (const target of targets) {
        const change = executeCommand(workspace, command, target.id)
        workspace = change.workspace
        labels.push(change.label)
        messages.push(change.label)
      }
      results.push(result('applied', messages.join(' · '), command))
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error
      results.push(result('invalid', error.message, command))
    }
  }

  return { workspace, results, labels }
}
