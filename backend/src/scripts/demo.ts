import { readFile } from 'node:fs/promises'
import type { AnalyzeEvent, ApiResponse } from '../types/api'
import type { CommandResult } from '../types/command'
import type { Stage } from '../types/pipeline'
import type { Workspace } from '../types/workspace'

// Feeds the three texts of the assignment, in order, through the running server and its real
// model, exactly like pasting them into the chat. Nothing here is canned.

const assignmentSamples = [
  { file: '01-brief.txt', title: 'בריף' },
  { file: '02-tasks.txt', title: 'משימות' },
  { file: '03-meetings.txt', title: 'פגישות' },
]

// With --commands, a fourth message is sent: instructions that change items the first three created.
const withCommands = process.argv.includes('--commands')
const samples = withCommands ? [...assignmentSamples, { file: '04-commands.txt', title: 'הוראות' }] : assignmentSamples

const stageLabels: Record<Stage, string> = {
  normalize: 'ניקוי ואיחוד הטקסט',
  detectReferenceDate: 'זיהוי תאריך ייחוס',
  extractCommands: 'זיהוי הוראות (מודל)',
  classify: 'סיווג הקטעים',
  extractBrief: 'קריאת בריף (מודל)',
  extractTasks: 'קריאת משימות (מודל)',
  extractMeetings: 'קריאת פגישות (מודל)',
  validate: 'אימות ציטוטים מול הטקסט',
  merge: 'מיזוג עם מה שכבר ידוע',
  prioritize: 'חישוב עדיפויות',
}

const apiFlag = process.argv.indexOf('--api')
const apiBase = apiFlag !== -1 ? process.argv[apiFlag + 1] : 'http://localhost:4000'
const uiBase = 'http://localhost:8080'

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, init)
  const body = (await response.json()) as ApiResponse<T>
  if (!body.ok) throw new Error(body.error)
  return body.data
}

async function analyze(workspaceId: string, text: string): Promise<{ workspace: Workspace; commandResults: CommandResult[] }> {
  const response = await fetch(`${apiBase}/api/workspaces/${workspaceId}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!response.ok || !response.body) {
    const body = (await response.json()) as ApiResponse<never>
    throw new Error(body.ok ? 'תשובה לא צפויה' : body.error)
  }

  let result: Workspace | null = null
  let commandResults: CommandResult[] = []
  let buffer = ''
  const decoder = new TextDecoder()
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const event = JSON.parse(frame.replace(/^data: /, '')) as AnalyzeEvent
      if (event.type === 'stage') {
        const { stage, status, detail } = event.event
        if (status !== 'running') {
          console.log(`   ${status === 'done' ? '✓' : status === 'skipped' ? '-' : '✗'} ${stageLabels[stage]}${detail ? `: ${detail}` : ''}`)
        }
      } else if (event.type === 'done') {
        result = event.workspace
        commandResults = event.commandResults
      } else {
        throw new Error(event.error)
      }
    }
  }
  if (!result) throw new Error('הזרם נגמר בלי תוצאה')
  return { workspace: result, commandResults }
}

function printResult(workspace: Workspace): void {
  console.log('\n══════════ תוצאה ══════════')
  console.log(`תאריך ייחוס: ${workspace.referenceDate} (${workspace.referenceDateOrigin})`)

  if (workspace.brief) {
    console.log('\nבריף')
    for (const [key, field] of Object.entries(workspace.brief.fields)) {
      const mark = field.verified ? '✓' : field.status === 'missing' ? '?' : '!'
      console.log(`  ${mark} ${key.padEnd(10)} [${field.status}] ${field.value ?? '-'}`)
    }
    const live = (items: { field: { value: string | null; verified: boolean }; deleted: boolean }[]) => items.filter((item) => !item.deleted)
    live(workspace.brief.deliverables).forEach(({ field: f }) => console.log(`  • תוצר: ${f.value}${f.verified ? '' : '  (לא מאומת)'}`))
    live(workspace.brief.constraints).forEach(({ field: f }) => console.log(`  • תנאי: ${f.value}${f.verified ? '' : '  (לא מאומת)'}`))
    live(workspace.brief.suggestions).forEach(({ field: f }) => console.log(`  • הצעה (הנחה): ${f.value}`))
  }

  console.log('\nמשימות')
  const tasks = workspace.tasks.filter((task) => !task.deleted).sort((a, b) => (a.priority ?? 'z').localeCompare(b.priority ?? 'z'))
  for (const task of tasks) {
    const when = `${task.dueDate.value ?? '—'} ${task.dueTime.value ?? ''}`.trim()
    console.log(`  ${(task.priority ?? 'חסומה').toUpperCase().padEnd(6)} ${task.bucket.padEnd(6)} ${task.title}  [${when}]`)
    console.log(`         ↳ ${task.reason}`)
  }

  console.log('\nפגישות')
  const meetings = workspace.meetings.filter((meeting) => !meeting.deleted).sort((a, b) => `${a.date.value}${a.startTime.value}`.localeCompare(`${b.date.value}${b.startTime.value}`))
  for (const meeting of meetings) {
    const flags = [meeting.weekdayMismatch && 'יום לא תואם', meeting.awaitingScheduling && 'ממתינה לתיאום', meeting.conflictsWith.length > 0 && 'חופפת'].filter(Boolean)
    console.log(`  ${meeting.date.value ?? '—'} ${meeting.startTime.value ?? '--:--'}-${meeting.endTime.value ?? '--:--'}  ${meeting.topic}${flags.length ? `  ⚠ ${flags.join(', ')}` : ''}`)
  }

  console.log(`\nשאלות פתוחות (${workspace.questions.length})`)
  workspace.questions.forEach((q) => console.log(`  ? [${q.kind}] ${q.text}`))
}

async function main(): Promise<void> {
  const health = await call<{ modelConfigured: boolean }>('/api/health').catch(() => null)
  if (!health) {
    console.error(`אין חיבור לשרת ב-${apiBase}. להרצה: docker compose up --build  (או  npm start  ב-backend).`)
    process.exit(1)
  }
  if (!health.modelConfigured) {
    console.error('לא הוגדר מודל. יש להוסיף OPENAI_API_KEY לקובץ .env ולהפעיל את השרת מחדש.')
    process.exit(1)
  }

  const workspace = await call<Workspace>('/api/workspaces', { method: 'POST' })
  console.log(`נוצר workspace חדש: ${workspace.id}`)

  let latest = workspace
  for (const sample of samples) {
    const text = await readFile(new URL(`../../samples/${sample.file}`, import.meta.url), 'utf8')
    console.log(`\n▶ ${sample.title} (${sample.file}, ${text.length} תווים)`)
    const outcome = await analyze(workspace.id, text)
    latest = outcome.workspace
    for (const item of outcome.commandResults) {
      console.log(`   ⚙ [${item.status}] ${item.message}${item.choices.length ? `  (${item.choices.map((c) => c.label).join(' | ')})` : ''}`)
    }
  }

  printResult(latest)
  console.log(`\nלפתיחה בממשק: ${uiBase}/?workspace=${workspace.id}`)
}

main().catch((error) => {
  console.error('\nהדמו נכשל:', error instanceof Error ? error.message : error)
  process.exit(1)
})
