import type { Brief, BriefFieldKey, BriefItem } from '../types/brief'
import type { Meeting } from '../types/meeting'
import type { Field } from '../types/provenance'
import type { Task } from '../types/task'
import type { Contradiction, FieldTarget, Workspace } from '../types/workspace'

export interface Extraction {
  briefs: Brief[]
  tasks: Task[]
  meetings: Meeting[]
}

function key(text: string | null): string {
  return (text ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

function sameValue(a: Field, b: Field): boolean {
  return key(a.value) === key(b.value)
}

interface MergedField {
  field: Field
  contradiction: Field | null
}

// A known value is never overwritten by a model. A gap may be filled. A user's edit
// always wins. Two different stated values are kept apart and become a question.
function mergeField(existing: Field, incoming: Field): MergedField {
  if (existing.editedByUser) return { field: existing, contradiction: null }
  if (incoming.value === null) return { field: existing, contradiction: null }
  if (existing.value === null) return { field: incoming, contradiction: null }
  if (sameValue(existing, incoming)) return { field: existing, contradiction: null }
  return { field: existing, contradiction: incoming }
}

function contradictionOf(target: FieldTarget, existing: Field, incoming: Field): Contradiction {
  const id =
    target.type === 'brief'
      ? `contradiction:brief:${target.briefId}:${target.key}`
      : `contradiction:${target.type}:${target.id}:${target.key}`
  return { id, target, existing, incoming }
}

// Deleted entries stay in the list on purpose: they still count as known, so a paste of the same
// text does not bring them back.
function addUnique(existing: BriefItem[], incoming: BriefItem[]): BriefItem[] {
  const known = new Set(existing.map((item) => key(item.field.value)))
  const added = incoming.filter((item) => {
    const id = key(item.field.value)
    if (known.has(id)) return false
    known.add(id)
    return true
  })
  return [...existing, ...added]
}

// Two briefs are the same request when they agree on the client, the campaign, or the message -
// whichever of those either side actually stated. Two briefs that state nothing in common (both
// blank on all three) are treated as different, so an incomplete brief never silently absorbs an
// unrelated one; pasting the same text twice still matches, since at least one of these repeats.
function sameBrief(a: Brief, b: Brief): boolean {
  return (['client', 'campaign', 'message'] as const).some((briefKey) => {
    const left = a.fields[briefKey].value
    const right = b.fields[briefKey].value
    return left !== null && right !== null && key(left) === key(right)
  })
}

function mergeOneBrief(existing: Brief, incoming: Brief): { brief: Brief; contradictions: Contradiction[] } {
  const contradictions: Contradiction[] = []
  const fields = { ...existing.fields }
  for (const briefKey of Object.keys(fields) as BriefFieldKey[]) {
    const merged = mergeField(existing.fields[briefKey], incoming.fields[briefKey])
    fields[briefKey] = merged.field
    if (merged.contradiction) {
      contradictions.push(
        contradictionOf(
          { type: 'brief', briefId: existing.id, key: briefKey },
          existing.fields[briefKey],
          merged.contradiction,
        ),
      )
    }
  }

  return {
    brief: {
      ...existing,
      fields,
      deliverables: addUnique(existing.deliverables, incoming.deliverables),
      constraints: addUnique(existing.constraints, incoming.constraints),
      suggestions: addUnique(existing.suggestions, incoming.suggestions),
      missingDetails: addUnique(existing.missingDetails, incoming.missingDetails),
    },
    contradictions,
  }
}

// Each incoming brief either matches one already known (merged field by field into it) or joins the
// list as its own card - the same "add, never silently overwrite" rule as tasks and meetings. Folded
// one at a time, so two distinct new briefs pasted in the same message both end up as separate cards.
function mergeBriefs(existing: Brief[], incoming: Brief[]): { briefs: Brief[]; contradictions: Contradiction[] } {
  let briefs = existing
  const contradictions: Contradiction[] = []
  for (const fresh of incoming) {
    const index = briefs.findIndex((brief) => sameBrief(brief, fresh))
    if (index === -1) {
      briefs = [...briefs, fresh]
      continue
    }
    const merged = mergeOneBrief(briefs[index], fresh)
    briefs = briefs.map((brief, i) => (i === index ? merged.brief : brief))
    contradictions.push(...merged.contradictions)
  }
  return { briefs, contradictions }
}

function sameTask(existing: Task, incoming: Task): boolean {
  return key(existing.quote.value) === key(incoming.quote.value) || key(existing.title) === key(incoming.title)
}

// A message that is essentially one sentence is that sentence typed on purpose. A deleted card must not
// come back when a long list is pasted again, but typing it again by itself is a new card.
function typedOnPurpose(inputText: string, quote: string | null): boolean {
  const text = inputText.trim()
  return text.length > 0 && (quote ?? '').length / text.length >= 0.8
}

function mergeTasks(
  existing: Task[],
  incoming: Task[],
  inputText: string,
): { tasks: Task[]; contradictions: Contradiction[] } {
  const contradictions: Contradiction[] = []
  const tasks = [...existing]

  for (const fresh of incoming) {
    const index = tasks.findIndex((task) => !task.deleted && sameTask(task, fresh))
    if (index === -1) {
      const buried = tasks.some((task) => task.deleted && sameTask(task, fresh))
      if (!buried || typedOnPurpose(inputText, fresh.quote.value)) tasks.push(fresh)
      continue
    }
    let known = tasks[index]
    for (const fieldKey of ['dueDate', 'dueTime'] as const) {
      const merged = mergeField(known[fieldKey], fresh[fieldKey])
      known = { ...known, [fieldKey]: merged.field }
      if (merged.contradiction) {
        contradictions.push(
          contradictionOf({ type: 'task', id: known.id, key: fieldKey }, known[fieldKey], merged.contradiction),
        )
      }
    }
    tasks[index] = known
  }
  return { tasks, contradictions }
}

function sameMeeting(existing: Meeting, incoming: Meeting): boolean {
  if (key(existing.quote.value) === key(incoming.quote.value)) return true
  return (
    key(existing.topic) === key(incoming.topic) &&
    existing.date.value !== null &&
    existing.date.value === incoming.date.value
  )
}

function mergeMeetings(
  existing: Meeting[],
  incoming: Meeting[],
  inputText: string,
): { meetings: Meeting[]; contradictions: Contradiction[] } {
  const contradictions: Contradiction[] = []
  const meetings = [...existing]

  for (const fresh of incoming) {
    const index = meetings.findIndex((meeting) => !meeting.deleted && sameMeeting(meeting, fresh))
    if (index === -1) {
      const buried = meetings.some((meeting) => meeting.deleted && sameMeeting(meeting, fresh))
      if (!buried || typedOnPurpose(inputText, fresh.quote.value)) meetings.push(fresh)
      continue
    }
    let known = meetings[index]
    for (const fieldKey of ['date', 'startTime', 'endTime'] as const) {
      const merged = mergeField(known[fieldKey], fresh[fieldKey])
      known = { ...known, [fieldKey]: merged.field }
      if (merged.contradiction) {
        contradictions.push(
          contradictionOf({ type: 'meeting', id: known.id, key: fieldKey }, known[fieldKey], merged.contradiction),
        )
      }
    }
    meetings[index] = known
  }
  return { meetings, contradictions }
}

// Contradictions already open stay open; a new one for the same field replaces the old one.
function mergeContradictions(open: Contradiction[], fresh: Contradiction[]): Contradiction[] {
  const byId = new Map(open.map((item) => [item.id, item]))
  for (const item of fresh) byId.set(item.id, item)
  return [...byId.values()]
}

export function mergeExtraction(workspace: Workspace, extraction: Extraction, inputText = ''): Workspace {
  const briefs = mergeBriefs(workspace.briefs, extraction.briefs)
  const tasks = mergeTasks(workspace.tasks, extraction.tasks, inputText)
  const meetings = mergeMeetings(workspace.meetings, extraction.meetings, inputText)

  return {
    ...workspace,
    briefs: briefs.briefs,
    tasks: tasks.tasks,
    meetings: meetings.meetings,
    contradictions: mergeContradictions(workspace.contradictions, [
      ...briefs.contradictions,
      ...tasks.contradictions,
      ...meetings.contradictions,
    ]),
  }
}
