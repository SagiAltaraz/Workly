export type CommandAction =
  | 'addTask'
  | 'editTask'
  | 'completeTask'
  | 'reopenTask'
  | 'deleteTask'
  | 'unblockTask'
  | 'addMeeting'
  | 'editMeeting'
  | 'deleteMeeting'

// An instruction from the chat after code parsed every date and time in it. Only the target
// item is still open, and a person may have to pick it.
export interface ResolvedCommand {
  action: CommandAction
  quote: string
  title: string | null
  date: string | null
  startTime: string | null
  endTime: string | null
  participants: string[]
}

export interface CommandChoice {
  targetId: string
  label: string
}

export type CommandStatus = 'applied' | 'needsChoice' | 'notFound' | 'invalid'

export interface CommandResult {
  status: CommandStatus
  message: string
  command: ResolvedCommand | null
  choices: CommandChoice[]
}
