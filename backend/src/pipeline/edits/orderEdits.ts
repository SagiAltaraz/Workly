import { ValidationError } from '../../errors'
import type { Workspace } from '../../types/workspace'
import type { Change } from './change'

// The person's order for cards that have no hour. Only ids of cards that exist are kept, each once,
// in the order given. The board decides what an order means for a column; the server just remembers it.
export function setCardOrder(workspace: Workspace, ids: string[]): Change {
  const known = new Set([...workspace.tasks, ...workspace.meetings].filter((card) => !card.deleted).map((card) => card.id))
  const kept = [...new Set(ids)].filter((id) => known.has(id))
  if (kept.length === 0) throw new ValidationError('אין כרטיסים לסדר')
  return {
    workspace: { ...workspace, cardOrder: kept },
    label: 'שונה סדר הכרטיסים',
  }
}
