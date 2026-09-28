import type { Workspace } from '../../types/workspace'

// What an edit returns: the new state, and what happened in words. The words become the
// activity line, the chat confirmation and the undo label, so they are written once, here.
export interface Change {
  workspace: Workspace
  label: string
}
