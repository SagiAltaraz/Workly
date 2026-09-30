import { createOpenAiExtractor } from '../agents/openai.extractor'
import type { Extractor } from '../agents/extractor'
import { env } from '../config/env'
import { runPipeline } from '../pipeline/runPipeline'
import type { Workspace } from '../types/workspace'

// Runs messages through the real pipeline and prints what every stage received and returned:
// the raw answer of each agent first, then what the deterministic code made of it.
//   npm run trace -- "הודעה ראשונה" "הודעה שנייה"
// Nothing is saved and no database is needed.

if (!env.openaiApiKey) {
  console.error('לא הוגדר מודל. יש להוסיף OPENAI_API_KEY לקובץ .env')
  process.exit(1)
}

const messages = process.argv.slice(2)
if (messages.length === 0) {
  console.error('שימוש: npm run trace -- "הודעה ראשונה" "הודעה שנייה"')
  process.exit(1)
}

const section = (title: string) => console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`)
const show = (value: unknown) => console.log(JSON.stringify(value, null, 2))

// The real extractor, with each raw answer printed before the pipeline touches it.
function traced(inner: Extractor): Extractor {
  return {
    async extractCommands(input) {
      const result = await inner.extractCommands(input)
      section('סוכן הוראות: מה המודל החזיר (גולמי)')
      show(result)
      return result
    },
    async extractBrief(input) {
      const result = await inner.extractBrief(input)
      section('סוכן בריף: מה המודל החזיר (גולמי)')
      show(result)
      return result
    },
    async extractTasks(input) {
      section('סוכן משימות: הטקסט שהוא קיבל')
      console.log(input.text)
      const result = await inner.extractTasks(input)
      section('סוכן משימות: מה המודל החזיר (גולמי)')
      show(result)
      return result
    },
    async extractMeetings(input) {
      section('סוכן פגישות: הטקסט שהוא קיבל')
      console.log(input.text)
      const result = await inner.extractMeetings(input)
      section('סוכן פגישות: מה המודל החזיר (גולמי)')
      show(result)
      return result
    },
  }
}

function emptyWorkspace(): Workspace {
  const now = new Date().toISOString()
  return {
    id: 'trace',
    createdAt: now,
    updatedAt: now,
    referenceDate: null,
    referenceDateOrigin: null,
    sources: [],
    briefs: [],
    tasks: [],
    meetings: [],
    contradictions: [],
    dismissedQuestionIds: [],
    cardOrder: [],
    activity: [],
    questions: [],
  }
}

async function main() {
  const extractor = traced(createOpenAiExtractor(env.openaiApiKey as string, env.model))
  let workspace = emptyWorkspace()

  for (const message of messages) {
    console.log(`\n${'═'.repeat(64)}\nהודעה: ${message}\n${'═'.repeat(64)}`)
    const result = await runPipeline(workspace, { text: message, userReferenceDate: null }, extractor, (event) => {
      if (event.status !== 'running') console.log(`   [${event.stage}] ${event.status}${event.detail ? `: ${event.detail}` : ''}`)
    })
    workspace = result.workspace

    section('מה הקוד עשה בזה')
    result.commandResults.forEach((item) => console.log(`  הוראה [${item.status}] ${item.message}`))
    for (const task of workspace.tasks.filter((item) => !item.deleted)) {
      console.log(
        `  משימה "${task.title}"  תאריך=${task.dueDate.value ?? '—'} (${task.dueDate.status})  שעה=${task.dueTime.value ?? '—'} (${task.dueTime.status})`,
      )
      console.log(`     אותות שאומתו: ${JSON.stringify(Object.fromEntries(Object.entries(task.signals).filter(([, v]) => v)))}`)
      console.log(`     כלל: ${task.rule} → ${task.priority ?? 'חסומה'} · ${task.bucket} · ${task.reason}`)
    }
    for (const meeting of workspace.meetings.filter((item) => !item.deleted)) {
      console.log(`  פגישה "${meeting.topic}"  ${meeting.date.value ?? '—'} ${meeting.startTime.value ?? '--:--'}–${meeting.endTime.value ?? '--:--'}`)
    }
    workspace.questions.forEach((question) => console.log(`  שאלה [${question.kind}] ${question.text}`))
  }
}

main().catch((error) => {
  console.error('העקיבה נכשלה:', error instanceof Error ? error.message : error)
  process.exit(1)
})
