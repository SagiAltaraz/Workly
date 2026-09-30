import { randomUUID } from 'node:crypto'
import type { Meeting } from '../../types/meeting'
import type { Workspace } from '../../types/workspace'
import { ValidationError } from '../../errors'
import { timeToMinutes, formatTime } from '../dateMath'
import { missingField, userField } from '../fields'
import { recompute } from '../recompute'
import type { Change } from './change'
import { clearedField } from './fieldEdits'
import { dropContradictions, replaceMeeting, requireMeeting } from './lookup'
import { assertDate, assertText, assertTime, shownValue } from './validation'

export interface NewMeetingInput {
  topic: string
  date: string | null
  startTime: string | null
  endTime: string | null
  participants: string[]
}

function cleanParticipants(names: string[]): string[] {
  return names.map((name) => name.trim()).filter((name) => name.length > 0)
}

export function addMeeting(workspace: Workspace, input: NewMeetingInput): Change {
  const topic = assertText(input.topic, 'נושא הפגישה')
  const meeting: Meeting = {
    id: randomUUID(),
    topic,
    quote: userField(topic),
    weekdayWritten: null,
    date: input.date !== null ? userField(assertDate(input.date)) : missingField(),
    startTime: input.startTime !== null ? userField(assertTime(input.startTime)) : missingField(),
    endTime: input.endTime !== null ? userField(assertTime(input.endTime)) : missingField(),
    participants: cleanParticipants(input.participants),
    dayPart: null,
    awaitingScheduling: false,
    weekdayMismatch: false,
    conflictsWith: [],
    deleted: false,
  }
  return { workspace: recompute({ ...workspace, meetings: [...workspace.meetings, meeting] }), label: `נוספה פגישה "${topic}"` }
}

// null clears a value; leaving a key out leaves it alone.
export interface MeetingPatch {
  topic?: string
  participants?: string[]
  date?: string | null
  startTime?: string | null
  endTime?: string | null
}

interface PatchOptions {
  // "The meeting moved to 11:00" keeps its length: the end time moves with the start.
  keepDuration: boolean
}

function shiftedEnd(meeting: Meeting, newStart: string): string | null {
  if (!meeting.startTime.value || !meeting.endTime.value) return null
  const length = timeToMinutes(meeting.endTime.value) - timeToMinutes(meeting.startTime.value)
  const end = timeToMinutes(newStart) + length
  return length > 0 && end < 24 * 60 ? formatTime(Math.floor(end / 60), end % 60) : null
}

export function patchMeeting(
  workspace: Workspace,
  meetingId: string,
  patch: MeetingPatch,
  options: PatchOptions = { keepDuration: false },
): Change {
  const original = requireMeeting(workspace, meetingId)
  let meeting = original
  const parts: string[] = []
  const settled: string[] = []
  const valueOf = (raw: string | null, check: (value: string) => string) => (raw === null ? null : check(raw))

  if (patch.topic !== undefined) {
    meeting = { ...meeting, topic: assertText(patch.topic, 'נושא הפגישה') }
    parts.push(`נושא ← "${meeting.topic}"`)
  }
  if (patch.participants !== undefined) {
    meeting = { ...meeting, participants: cleanParticipants(patch.participants) }
    parts.push(`משתתפים ← ${meeting.participants.join(', ') || 'ללא'}`)
  }
  if (patch.date !== undefined) {
    const value = valueOf(patch.date, assertDate)
    meeting = { ...meeting, date: value === null ? clearedField() : userField(value) }
    parts.push(`תאריך: ${shownValue(original.date.value)} ← ${shownValue(value)}`)
    settled.push('date')
  }
  if (patch.startTime !== undefined) {
    const value = valueOf(patch.startTime, assertTime)
    meeting = { ...meeting, startTime: value === null ? clearedField() : userField(value) }
    parts.push(`שעת התחלה: ${shownValue(original.startTime.value)} ← ${shownValue(value)}`)
    settled.push('startTime')
    if (value !== null && patch.endTime === undefined && options.keepDuration) {
      const end = shiftedEnd(original, value)
      if (end) {
        meeting = { ...meeting, endTime: userField(end) }
        parts.push(`שעת סיום: ${shownValue(original.endTime.value)} ← ${end} (אותו אורך)`)
        settled.push('endTime')
      }
    }
  }
  if (patch.endTime !== undefined) {
    const value = valueOf(patch.endTime, assertTime)
    meeting = { ...meeting, endTime: value === null ? clearedField() : userField(value) }
    parts.push(`שעת סיום: ${shownValue(original.endTime.value)} ← ${shownValue(value)}`)
    settled.push('endTime')
  }
  if (parts.length === 0) throw new ValidationError('אין מה לעדכן')

  let next = replaceMeeting(workspace, meeting)
  if (settled.length > 0) next = dropContradictions(next, 'meeting', meetingId, settled)
  return { workspace: recompute(next), label: `פגישה "${meeting.topic}": ${parts.join(', ')}` }
}

export function deleteMeeting(workspace: Workspace, meetingId: string): Change {
  const meeting = requireMeeting(workspace, meetingId)
  return {
    workspace: recompute(replaceMeeting(workspace, { ...meeting, deleted: true })),
    label: `נמחקה פגישה "${meeting.topic}"`,
  }
}

export function restoreMeeting(workspace: Workspace, meetingId: string): Change {
  const meeting = requireMeeting(workspace, meetingId)
  return {
    workspace: recompute(replaceMeeting(workspace, { ...meeting, deleted: false })),
    label: `שוחזרה פגישה "${meeting.topic}"`,
  }
}
