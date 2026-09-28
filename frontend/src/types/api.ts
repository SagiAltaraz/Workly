import type { CommandResult } from './command'
import type { StageEvent } from './pipeline'
import type { Workspace } from './workspace'

// Every response, expected or not, has this shape.
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// One frame of the analyze stream.
export type AnalyzeEvent =
  | { ok: true; type: 'stage'; event: StageEvent }
  | { ok: true; type: 'done'; workspace: Workspace; commandResults: CommandResult[] }
  | { ok: false; type: 'error'; error: string }
