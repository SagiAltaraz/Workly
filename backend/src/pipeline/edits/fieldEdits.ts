import { NotFoundError, ValidationError } from '../../errors'
import type { Field } from '../../types/provenance'
import type { FieldTarget, Workspace } from '../../types/workspace'
import { userField } from '../fields'
import { labelOfTarget } from '../labels'
import { recompute } from '../recompute'
import type { Change } from './change'
import { assertDate, assertText, assertTime, shownValue } from './validation'

const dateKeys = new Set(['deadline', 'launchDate', 'dueDate', 'date'])
const timeKeys = new Set(['dueTime', 'startTime', 'endTime'])

function checkedValue(key: string, value: string): string {
  const cleaned = assertText(value, 'הערך')
  if (dateKeys.has(key)) return assertDate(cleaned)
  if (timeKeys.has(key)) return assertTime(cleaned)
  return cleaned
}

export function readField(workspace: Workspace, target: FieldTarget): Field {
  if (target.type === 'brief') {
    if (!workspace.brief) throw new NotFoundError('אין בריף ב-workspace')
    return workspace.brief.fields[target.key]
  }
  if (target.type === 'task') {
    const task = workspace.tasks.find((item) => item.id === target.id)
    if (!task) throw new NotFoundError('המשימה לא נמצאה')
    return task[target.key]
  }
  const meeting = workspace.meetings.find((item) => item.id === target.id)
  if (!meeting) throw new NotFoundError('הפגישה לא נמצאה')
  return meeting[target.key]
}

function writeField(workspace: Workspace, target: FieldTarget, field: Field): Workspace {
  readField(workspace, target)
  if (target.type === 'brief' && workspace.brief) {
    return { ...workspace, brief: { ...workspace.brief, fields: { ...workspace.brief.fields, [target.key]: field } } }
  }
  if (target.type === 'task') {
    return {
      ...workspace,
      tasks: workspace.tasks.map((task) => (task.id === target.id ? { ...task, [target.key]: field } : task)),
    }
  }
  if (target.type === 'meeting') {
    return {
      ...workspace,
      meetings: workspace.meetings.map((meeting) =>
        meeting.id === target.id ? { ...meeting, [target.key]: field } : meeting,
      ),
    }
  }
  return workspace
}

function withoutContradiction(workspace: Workspace, target: FieldTarget): Workspace {
  const same = (item: Workspace['contradictions'][number]) =>
    item.target.type === target.type &&
    item.target.key === target.key &&
    ('id' in item.target ? item.target.id : null) === ('id' in target ? target.id : null)
  return { ...workspace, contradictions: workspace.contradictions.filter((item) => !same(item)) }
}

function ownerOf(workspace: Workspace, target: FieldTarget): string {
  if (target.type === 'brief') return 'בריף'
  if (target.type === 'task') return `משימה "${workspace.tasks.find((task) => task.id === target.id)?.title ?? ''}"`
  return `פגישה "${workspace.meetings.find((meeting) => meeting.id === target.id)?.topic ?? ''}"`
}

// A cleared value still counts as the user's own, so a later paste cannot fill it back in.
export function clearedField(): Field {
  return { value: null, status: 'missing', quote: null, span: null, verified: false, editedByUser: true, note: null }
}

// A hand edit outranks anything a model produced, and closes any open contradiction on it.
export function editField(workspace: Workspace, target: FieldTarget, value: string): Change {
  const before = readField(workspace, target).value
  const cleaned = checkedValue(target.key, value)
  const edited = withoutContradiction(writeField(workspace, target, userField(cleaned)), target)
  return {
    workspace: recompute(edited),
    label: `${ownerOf(workspace, target)} · ${labelOfTarget(target)}: ${shownValue(before)} ← ${cleaned}`,
  }
}

export function clearField(workspace: Workspace, target: FieldTarget): Change {
  const before = readField(workspace, target).value
  if (before === null) throw new ValidationError('אין ערך למחוק')
  const cleared = withoutContradiction(writeField(workspace, target, clearedField()), target)
  return {
    workspace: recompute(cleared),
    label: `${ownerOf(workspace, target)} · ${labelOfTarget(target)}: ${before} ← ללא`,
  }
}

export function resolveContradiction(
  workspace: Workspace,
  contradictionId: string,
  choice: 'keepExisting' | 'useIncoming',
): Change {
  const contradiction = workspace.contradictions.find((item) => item.id === contradictionId)
  if (!contradiction) throw new NotFoundError('השאלה לא נמצאה')
  const chosen = choice === 'useIncoming' ? contradiction.incoming : contradiction.existing
  // The person just confirmed this value, so later pastes must not overwrite or re-question it.
  const confirmed: Field = { ...chosen, editedByUser: true }
  const written = writeField(workspace, contradiction.target, confirmed)
  return {
    workspace: recompute(withoutContradiction(written, contradiction.target)),
    label: `נבחר "${chosen.value ?? ''}" עבור ${ownerOf(workspace, contradiction.target)} · ${labelOfTarget(contradiction.target)}`,
  }
}
