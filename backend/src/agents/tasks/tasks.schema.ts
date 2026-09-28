import { z } from 'zod'

const canWait = z.object({
  kind: z.enum(['tomorrow', 'laterThisWeek']),
  quote: z.string(),
})

export const taskSignalSchema = z.object({
  title: z.string(),
  quote: z.string(),
  sectionHeading: z.string().nullable(),
  dueDateText: z.string().nullable(),
  dueTimeText: z.string().nullable(),
  urgencyWording: z.string().nullable(),
  externalWaiting: z.string().nullable(),
  blocksOthers: z.string().nullable(),
  condition: z.string().nullable(),
  canWait: canWait.nullable(),
  notUrgent: z.string().nullable(),
})

export const tasksSignalsSchema = z.object({
  tasks: z.array(taskSignalSchema),
})

export type TaskSignal = z.infer<typeof taskSignalSchema>
