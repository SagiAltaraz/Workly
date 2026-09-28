import { describe, expect, it } from 'vitest'
import { maxSnapshots, recordChange, undoLastChange, type Snapshot } from '../src/services/history'
import { emptyWorkspace } from './helpers'
import type { Workspace } from '../src/types/workspace'

const now = new Date('2026-09-23T10:00:00Z')
const named = (name: string): Workspace => ({ ...emptyWorkspace(), id: name })

describe('history', () => {
  it('records what changed and keeps the state before it', () => {
    const before = emptyWorkspace()
    const after = { ...before, referenceDate: '2026-09-24' }
    const recorded = recordChange(before, after, [], 'שינוי בדיקה', now)
    expect(recorded.workspace.activity).toHaveLength(1)
    expect(recorded.workspace.activity[0].label).toBe('שינוי בדיקה')
    expect(recorded.history).toHaveLength(1)
    expect(recorded.history[0].workspace.referenceDate).toBeNull()
  })

  it('undo restores the state before the last change and removes it from the activity', () => {
    const start = emptyWorkspace()
    const one = recordChange(start, { ...start, referenceDate: '2026-09-24' }, [], 'ראשון', now)
    const two = recordChange(one.workspace, { ...one.workspace, referenceDate: '2026-09-25' }, one.history, 'שני', now)

    const undoneTwo = undoLastChange(two.workspace, two.history, now)!
    expect(undoneTwo.undoneLabel).toBe('שני')
    expect(undoneTwo.workspace.referenceDate).toBe('2026-09-24')
    expect(undoneTwo.workspace.activity.map((entry) => entry.label)).toEqual(['ראשון'])

    const undoneOne = undoLastChange(undoneTwo.workspace, undoneTwo.history, now)!
    expect(undoneOne.workspace.referenceDate).toBeNull()
    expect(undoLastChange(undoneOne.workspace, undoneOne.history, now)).toBeNull()
  })

  it('keeps only the most recent snapshots', () => {
    let workspace = emptyWorkspace()
    let history: Snapshot[] = []
    for (let index = 0; index < maxSnapshots + 5; index += 1) {
      const recorded = recordChange(workspace, { ...workspace, id: `w${index}` }, history, `שינוי ${index}`, now)
      workspace = recorded.workspace
      history = recorded.history
    }
    expect(history).toHaveLength(maxSnapshots)
    expect(named('x').id).toBe('x')
  })
})
