import OpenAI from 'openai'
import { briefSignalsSchema, type BriefSignal } from './brief/brief.schema'
import { briefSystemPrompt } from './brief/brief.prompt'
import { commandsSignalsSchema, type CommandSignal } from './commands/commands.schema'
import { commandsSystemPrompt } from './commands/commands.prompt'
import type { ExtractionInput, Extractor } from './extractor'
import { meetingsSignalsSchema, type MeetingSignal } from './meetings/meetings.schema'
import { meetingsSystemPrompt } from './meetings/meetings.prompt'
import { runAgent } from './runAgent'
import { tasksSignalsSchema, type TaskSignal } from './tasks/tasks.schema'
import { tasksSystemPrompt } from './tasks/tasks.prompt'

export function createOpenAiExtractor(apiKey: string, model: string): Extractor {
  const client = new OpenAI({ apiKey })

  return {
    async extractCommands({ text }: ExtractionInput): Promise<CommandSignal[]> {
      const result = await runAgent({
        client,
        model,
        systemPrompt: commandsSystemPrompt,
        userText: text,
        schema: commandsSignalsSchema,
        schemaName: 'commandsSignals',
      })
      return result.commands
    },

    async extractBrief({ text }: ExtractionInput): Promise<BriefSignal[]> {
      const result = await runAgent({
        client,
        model,
        systemPrompt: briefSystemPrompt,
        userText: text,
        schema: briefSignalsSchema,
        schemaName: 'briefSignals',
      })
      return result.briefs
    },

    async extractTasks({ text }: ExtractionInput): Promise<TaskSignal[]> {
      const result = await runAgent({
        client,
        model,
        systemPrompt: tasksSystemPrompt,
        userText: text,
        schema: tasksSignalsSchema,
        schemaName: 'tasksSignals',
      })
      return result.tasks
    },

    async extractMeetings({ text }: ExtractionInput): Promise<MeetingSignal[]> {
      const result = await runAgent({
        client,
        model,
        systemPrompt: meetingsSystemPrompt,
        userText: text,
        schema: meetingsSignalsSchema,
        schemaName: 'meetingsSignals',
      })
      return result.meetings
    },
  }
}
