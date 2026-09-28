import type { BriefSignals } from './brief/brief.schema'
import type { CommandSignal } from './commands/commands.schema'
import type { MeetingSignal } from './meetings/meetings.schema'
import type { TaskSignal } from './tasks/tasks.schema'

export interface ExtractionInput {
  text: string
}

// The only thing the pipeline knows about the LLM. Tests inject a stub with fixed data,
// so the whole deterministic half runs with no network call and no API key.
export interface Extractor {
  extractCommands(input: ExtractionInput): Promise<CommandSignal[]>
  extractBrief(input: ExtractionInput): Promise<BriefSignals>
  extractTasks(input: ExtractionInput): Promise<TaskSignal[]>
  extractMeetings(input: ExtractionInput): Promise<MeetingSignal[]>
}
