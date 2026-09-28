export type Stage =
  | 'normalize'
  | 'detectReferenceDate'
  | 'extractCommands'
  | 'classify'
  | 'extractBrief'
  | 'extractTasks'
  | 'extractMeetings'
  | 'validate'
  | 'merge'
  | 'prioritize'

export type StageStatus = 'running' | 'done' | 'skipped' | 'failed'

export interface StageEvent {
  stage: Stage
  status: StageStatus
  detail: string | null
}
