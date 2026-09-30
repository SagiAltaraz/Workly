import { randomUUID } from 'node:crypto'
import { NotFoundError, ValidationError } from '../../errors'
import type { Brief, BriefFieldKey, BriefItem, BriefListKey } from '../../types/brief'
import type { Workspace } from '../../types/workspace'
import { missingField, userField } from '../fields'
import { recompute } from '../recompute'
import type { Change } from './change'
import { assertText } from './validation'

const listKeys: BriefListKey[] = ['deliverables', 'constraints', 'suggestions', 'missingDetails']
const fieldKeys: BriefFieldKey[] = ['client', 'campaign', 'message', 'audience', 'tone', 'deadline', 'launchDate']

// A brief typed in by hand starts with every field missing.
export function emptyBrief(): Brief {
  const fields = Object.fromEntries(fieldKeys.map((key) => [key, missingField()])) as Brief['fields']
  return { id: randomUUID(), fields, deliverables: [], constraints: [], suggestions: [], missingDetails: [] }
}

function requireBrief(workspace: Workspace, briefId: string): Brief {
  const brief = workspace.briefs.find((item) => item.id === briefId)
  if (!brief) throw new NotFoundError('הבריף לא נמצא')
  return brief
}

function briefLabel(brief: Brief): string {
  const name = brief.fields.client.value ?? brief.fields.campaign.value
  return name ? `בריף "${name}"` : 'בריף'
}

function newItem(text: string): BriefItem {
  return { id: randomUUID(), field: userField(text), deleted: false }
}

interface Found {
  brief: Brief
  list: BriefListKey
  item: BriefItem
}

// An item's own id is unique across every brief in the workspace, so a person acting on an item
// (editing, deleting, answering) never needs to say which brief it belongs to.
function findItem(workspace: Workspace, itemId: string): Found {
  for (const brief of workspace.briefs) {
    for (const list of listKeys) {
      const item = brief[list].find((entry) => entry.id === itemId)
      if (item) return { brief, list, item }
    }
  }
  throw new NotFoundError('הפריט לא נמצא')
}

function withBrief(workspace: Workspace, brief: Brief): Workspace {
  const known = workspace.briefs.some((item) => item.id === brief.id)
  return {
    ...workspace,
    briefs: known
      ? workspace.briefs.map((item) => (item.id === brief.id ? brief : item))
      : [...workspace.briefs, brief],
  }
}

function withItem(brief: Brief, list: BriefListKey, item: BriefItem): Brief {
  return { ...brief, [list]: brief[list].map((entry) => (entry.id === item.id ? item : entry)) }
}

function change(workspace: Workspace, brief: Brief, label: string): Change {
  return { workspace: recompute(withBrief(workspace, brief)), label }
}

// A blank card, for the "+ בריף חדש" button. Text pasted into the chat never needs this: the
// extractor always creates its own brief the first time it finds one.
export function addBrief(workspace: Workspace): Change {
  const brief = emptyBrief()
  return { workspace: recompute(withBrief(workspace, brief)), label: 'נוסף בריף חדש' }
}

// null when the caller means "start a new brief" - used by the empty state's own "+ תוצר / + תנאי"
// buttons, which both create the first brief and add its first item in one step.
export function addBriefItem(
  workspace: Workspace,
  briefId: string | null,
  list: 'deliverables' | 'constraints',
  text: string,
): Change {
  const cleaned = assertText(text, 'הטקסט')
  const brief = briefId ? requireBrief(workspace, briefId) : emptyBrief()
  const noun = list === 'deliverables' ? 'תוצר' : 'תנאי'
  return change(workspace, { ...brief, [list]: [...brief[list], newItem(cleaned)] }, `נוסף ${noun} ל${briefLabel(brief)}: "${cleaned}"`)
}

export function editBriefItem(workspace: Workspace, itemId: string, text: string): Change {
  const cleaned = assertText(text, 'הטקסט')
  const { brief, list, item } = findItem(workspace, itemId)
  return change(
    workspace,
    withItem(brief, list, { ...item, field: userField(cleaned) }),
    `ב${briefLabel(brief)} עודכן: "${item.field.value ?? ''}" ← "${cleaned}"`,
  )
}

export function deleteBriefItem(workspace: Workspace, itemId: string): Change {
  const { brief, list, item } = findItem(workspace, itemId)
  return change(workspace, withItem(brief, list, { ...item, deleted: true }), `הוסר מ${briefLabel(brief)}: "${item.field.value ?? ''}"`)
}

export function restoreBriefItem(workspace: Workspace, itemId: string): Change {
  const { brief, list, item } = findItem(workspace, itemId)
  return change(workspace, withItem(brief, list, { ...item, deleted: false }), `שוחזר ב${briefLabel(brief)}: "${item.field.value ?? ''}"`)
}

// Accepting a suggestion turns a guess into something the person owns.
export function promoteSuggestion(workspace: Workspace, itemId: string, into: 'deliverables' | 'constraints'): Change {
  const { brief, list, item } = findItem(workspace, itemId)
  if (list !== 'suggestions') throw new ValidationError('רק הצעה אפשר לאשר')
  const promoted = newItem(item.field.value ?? '')
  const next: Brief = {
    ...withItem(brief, list, { ...item, deleted: true }),
    [into]: [...brief[into], promoted],
  }
  return change(workspace, next, `הצעה אושרה ונוספה ל${into === 'deliverables' ? 'תוצרים' : 'תנאים'} ב${briefLabel(brief)}: "${promoted.field.value}"`)
}

// Answering a missing detail closes it and records the answer as a condition of the brief.
export function answerMissingDetail(workspace: Workspace, itemId: string, answer: string): Change {
  const cleaned = assertText(answer, 'התשובה')
  const { brief, list, item } = findItem(workspace, itemId)
  if (list !== 'missingDetails') throw new ValidationError('זה לא פרט חסר')
  const detail = item.field.value ?? ''
  const answered = newItem(`${detail}: ${cleaned}`)
  const next: Brief = {
    ...withItem(brief, list, { ...item, deleted: true }),
    constraints: [...brief.constraints, answered],
  }
  return change(workspace, next, `נענה פרט חסר ב${briefLabel(brief)}: ${answered.field.value}`)
}
