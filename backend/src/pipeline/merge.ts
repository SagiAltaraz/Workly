import type { Brief, BriefFieldKey, BriefItem } from '../types/brief'
import type { Meeting } from '../types/meeting'
import type { Field } from '../types/provenance'
import type { Task } from '../types/task'
import type { Contradiction, FieldTarget, Workspace } from '../types/workspace'

export interface Extraction {
  brief: Brief | null
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
      ? `contradiction:brief:${target.key}`
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

function mergeBrief(
  existing: Brief | null,
  incoming: Brief | null,
): { brief: Brief | null; contradictions: Contradiction[] } {
  if (!incoming) return { brief: existing, contradictions: [] }
  if (!existing) return { brief: incoming, contradictions: [] }

  const contradictions: Contradiction[] = []
  const fields = { ...existing.fields }
  for (const briefKey of Object.keys(fields) as BriefFieldKey[]) {
    const merged = mergeField(existing.fields[briefKey], incoming.fields[briefKey])
    fields[briefKey] = merged.field
    if (merged.contradiction) {
      contradictions.push(
        contradictionOf({ type: 'brief', key: briefKey }, existing.fields[briefKey], merged.contradiction),
      )
    }
  }

  return {
    brief: {
      fields,
      deliverables: addUnique(existing.deliverables, incoming.deliverables),
      constraints: addUnique(existing.constraints, incoming.constraints),
      suggestions: addUnique(existing.suggestions, incoming.suggestions),
      missingDetails: addUnique(existing.missingDetails, incoming.missingDetails),
    },
    contradictions,
  }
}

function sameTask(existing: Task, incoming: Task): boolean {
  return key(existing.quote.value) === key(incoming.quote.value) || key(existing.title) === key(incoming.title)
}

function mergeTasks(
  existing: Task[],
  incoming: Task[],
): { tasks: Task[]; contradictions: Contradiction[] } {
  const contradictions: Contradiction[] = []
  const tasks = [...existing]

  for (const fresh of incoming) {
    const index = tasks.findIndex((task) => sameTask(task, fresh))
    if (index === -1) {
      tasks.push(fresh)
      continue
    }
    if (tasks[index].deleted) continue
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
): { meetings: Meeting[]; contradictions: Contradiction[] } {
  const contradictions: Contradiction[] = []
  const meetings = [...existing]

  for (const fresh of incoming) {
    const index = meetings.findIndex((meeting) => sameMeeting(meeting, fresh))
    if (index === -1) {
      meetings.push(fresh)
      continue
    }
    if (meetings[index].deleted) continue
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

export function mergeExtraction(workspace: Workspace, extraction: Extraction): Workspace {
  const brief = mergeBrief(workspace.brief, extraction.brief)
  const tasks = mergeTasks(workspace.tasks, extraction.tasks)
  const meetings = mergeMeetings(workspace.meetings, extraction.meetings)

  return {
    ...workspace,
    brief: brief.brief,
    tasks: tasks.tasks,
    meetings: meetings.meetings,
    contradictions: mergeContradictions(workspace.contradictions, [
      ...brief.contradictions,
      ...tasks.contradictions,
      ...meetings.contradictions,
    ]),
  }
}
