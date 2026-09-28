import { z } from 'zod'

export const meetingSignalSchema = z.object({
  topic: z.string(),
  quote: z.string(),
  sectionHeading: z.string().nullable(),
  weekdayText: z.string().nullable(),
  dateText: z.string().nullable(),
  timeText: z.string().nullable(),
  participants: z.array(z.string()),
})

export const meetingsSignalsSchema = z.object({
  meetings: z.array(meetingSignalSchema),
})

export type MeetingSignal = z.infer<typeof meetingSignalSchema>
