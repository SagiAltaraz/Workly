import { createContext, useContext } from 'react'
import type { WorkspaceApp } from '../hooks/useWorkspace'
import type { Field } from '../types/provenance'

// Everything an editor needs: what to show, and what saving (or clearing) does.
export interface EditRequest {
  label: string
  currentValue: string | null
  kind: 'date' | 'time' | 'text'
  hint?: string
  save: (value: string) => Promise<boolean>
  clear?: () => Promise<boolean>
}

export interface SourceRequest {
  field: Field
  label: string
}

// A card opened in full, to read and to change its fields.
export interface DetailRequest {
  kind: 'task' | 'meeting'
  id: string
}

export interface AppContextValue {
  app: WorkspaceApp
  showSource: (request: SourceRequest) => void
  requestEdit: (request: EditRequest) => void
  openDetail: (request: DetailRequest) => void
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside AppContext.Provider')
  return value
}
