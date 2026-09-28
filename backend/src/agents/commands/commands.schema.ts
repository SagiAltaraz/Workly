import { z } from 'zod'

export const commandSignalSchema = z.object({
  action: z.enum([
    'addTask',
    'editTask',
    'completeTask',
    'reopenTask',
    'deleteTask',
    'unblockTask',
    'addMeeting',
    'editMeeting',
    'deleteMeeting',
  ]),
  quote: z.string(),
  targetText: z.string().nullable(),
  title: z.string().nullable(),
  dateText: z.string().nullable(),
  timeText: z.string().nullable(),
  participants: z.array(z.string()),
})

export const commandsSignalsSchema = z.object({
  commands: z.array(commandSignalSchema),
})

export type CommandSignal = z.infer<typeof commandSignalSchema>
