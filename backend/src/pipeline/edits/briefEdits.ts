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
  return { fields, deliverables: [], constraints: [], suggestions: [], missingDetails: [] }
}

function requireBrief(workspace: Workspace): Brief {
  return workspace.brief ?? emptyBrief()
}

function newItem(text: string): BriefItem {
  return { id: randomUUID(), field: userField(text), deleted: false }
}

interface Found {
  list: BriefListKey
  item: BriefItem
}

function findItem(brief: Brief, itemId: string): Found {
  for (const list of listKeys) {
    const item = brief[list].find((entry) => entry.id === itemId)
    if (item) return { list, item }
  }
  throw new NotFoundError('הפריט לא נמצא')
}

function withItem(brief: Brief, list: BriefListKey, item: BriefItem): Brief {
  return { ...brief, [list]: brief[list].map((entry) => (entry.id === item.id ? item : entry)) }
}

function inBrief(workspace: Workspace, brief: Brief, label: string): Change {
  return { workspace: recompute({ ...workspace, brief }), label }
}

export function addBriefItem(workspace: Workspace, list: 'deliverables' | 'constraints', text: string): Change {
  const cleaned = assertText(text, 'הטקסט')
  const brief = requireBrief(workspace)
  const noun = list === 'deliverables' ? 'תוצר' : 'תנאי'
  return inBrief(workspace, { ...brief, [list]: [...brief[list], newItem(cleaned)] }, `נוסף ${noun} לבריף: "${cleaned}"`)
}

export function editBriefItem(workspace: Workspace, itemId: string, text: string): Change {
  const cleaned = assertText(text, 'הטקסט')
  const brief = requireBrief(workspace)
  const { list, item } = findItem(brief, itemId)
  return inBrief(workspace, withItem(brief, list, { ...item, field: userField(cleaned) }), `בבריף עודכן: "${item.field.value ?? ''}" ← "${cleaned}"`)
}

export function deleteBriefItem(workspace: Workspace, itemId: string): Change {
  const brief = requireBrief(workspace)
  const { list, item } = findItem(brief, itemId)
  return inBrief(workspace, withItem(brief, list, { ...item, deleted: true }), `הוסר מהבריף: "${item.field.value ?? ''}"`)
}

export function restoreBriefItem(workspace: Workspace, itemId: string): Change {
  const brief = requireBrief(workspace)
  const { list, item } = findItem(brief, itemId)
  return inBrief(workspace, withItem(brief, list, { ...item, deleted: false }), `שוחזר בבריף: "${item.field.value ?? ''}"`)
}

// Accepting a suggestion turns a guess into something the person owns.
export function promoteSuggestion(workspace: Workspace, itemId: string, into: 'deliverables' | 'constraints'): Change {
  const brief = requireBrief(workspace)
  const { list, item } = findItem(brief, itemId)
  if (list !== 'suggestions') throw new ValidationError('רק הצעה אפשר לאשר')
  const promoted = newItem(item.field.value ?? '')
  const next: Brief = {
    ...withItem(brief, list, { ...item, deleted: true }),
    [into]: [...brief[into], promoted],
  }
  return inBrief(workspace, next, `הצעה אושרה ונוספה ל${into === 'deliverables' ? 'תוצרים' : 'תנאים'}: "${promoted.field.value}"`)
}

// Answering a missing detail closes it and records the answer as a condition of the brief.
export function answerMissingDetail(workspace: Workspace, itemId: string, answer: string): Change {
  const cleaned = assertText(answer, 'התשובה')
  const brief = requireBrief(workspace)
  const { list, item } = findItem(brief, itemId)
  if (list !== 'missingDetails') throw new ValidationError('זה לא פרט חסר')
  const detail = item.field.value ?? ''
  const answered = newItem(`${detail}: ${cleaned}`)
  const next: Brief = {
    ...withItem(brief, list, { ...item, deleted: true }),
    constraints: [...brief.constraints, answered],
  }
  return inBrief(workspace, next, `נענה פרט חסר בבריף: ${answered.field.value}`)
}
