import { cases, evalNow, type EvalCase, type Expectation } from '../eval/cases'
import { createOpenAiExtractor } from '../agents/openai.extractor'
import { env } from '../config/env'
import { runPipeline } from '../pipeline/runPipeline'
import type { Workspace } from '../types/workspace'

// Runs the everyday-language cases through the real pipeline and the real model, and reports what
// held. Every bug found in real use belongs here as a new case.
//   npm run eval                    all cases, once
//   npm run eval -- --runs 3        each case three times, to see how steady the model is
//   npm run eval -- --only מחרר     only cases whose name contains the text

if (!env.openaiApiKey) {
  console.error('לא הוגדר מודל. יש להוסיף OPENAI_API_KEY לקובץ .env')
  process.exit(1)
}

const argument = (flag: string) => {
  const index = process.argv.indexOf(flag)
  return index === -1 ? null : (process.argv[index + 1] ?? null)
}
const runs = Number(argument('--runs') ?? 1)
const only = argument('--only')

function emptyWorkspace(): Workspace {
  const stamp = evalNow.toISOString()
  return {
    id: 'eval', createdAt: stamp, updatedAt: stamp, referenceDate: null, referenceDateOrigin: null,
    sources: [], briefs: [], tasks: [], meetings: [], contradictions: [], dismissedQuestionIds: [],
    cardOrder: [], activity: [], questions: [],
  }
}

function check(workspace: Workspace, expectation: Expectation): string[] {
  const tasks = workspace.tasks.filter((task) => !task.deleted)
  const meetings = workspace.meetings.filter((meeting) => !meeting.deleted)
  const problems: string[] = []
  const differ = (what: string, wanted: unknown, got: unknown) => {
    if (wanted !== undefined && wanted !== got) problems.push(`${what}: ציפיתי ל-${JSON.stringify(wanted)} וקיבלתי ${JSON.stringify(got)}`)
  }

  switch (expectation.kind) {
    case 'taskCount':
      differ('מספר משימות', expectation.count, tasks.length)
      break
    case 'meetingCount':
      differ('מספר פגישות', expectation.count, meetings.length)
      break
    case 'noQuestions':
      if (workspace.questions.length > 0) problems.push(`נשארו שאלות: ${workspace.questions.map((q) => q.text).join(' | ')}`)
      break
    case 'task': {
      const task = tasks.find((item) => !expectation.title || item.title.includes(expectation.title)) ?? (expectation.titleIncludes ? tasks[0] : undefined)
      if (!task) return [`לא נמצאה משימה עם "${expectation.title ?? ''}" בכותרת (יש: ${tasks.map((t) => t.title).join(', ') || 'אין'})`]
      differ(`"${task.title}" תאריך`, expectation.date, task.dueDate.value)
      differ(`"${task.title}" שעה`, expectation.time, task.dueTime.value)
      differ(`"${task.title}" עמודה`, expectation.bucket, task.bucket)
      differ(`"${task.title}" עדיפות`, expectation.priority, task.priority)
      differ(`"${task.title}" שעת דדליין`, expectation.deadlineTime, task.deadline.time)
      differ(`"${task.title}" חלק ביום`, expectation.dayPart, task.signals.dayPart)
      differ(`"${task.title}" חסומה`, expectation.blocked, task.blocked)
      if (expectation.titleIncludes && !task.title.includes(expectation.titleIncludes)) problems.push(`הכותרת "${task.title}" לא מכילה "${expectation.titleIncludes}"`)
      break
    }
    case 'meeting': {
      const meeting = meetings.find((item) => !expectation.topic || item.topic.includes(expectation.topic))
      if (!meeting) return [`לא נמצאה פגישה עם "${expectation.topic ?? ''}" בנושא (יש: ${meetings.map((m) => m.topic).join(', ') || 'אין'})`]
      differ(`"${meeting.topic}" תאריך`, expectation.date, meeting.date.value)
      differ(`"${meeting.topic}" שעה`, expectation.time, meeting.startTime.value)
      differ(`"${meeting.topic}" חלק ביום`, expectation.dayPart, meeting.dayPart)
      differ(`"${meeting.topic}" ממתינה לתיאום`, expectation.awaiting, meeting.awaitingScheduling)
      break
    }
  }
  return problems
}

async function runCase(testCase: EvalCase, extractor: ReturnType<typeof createOpenAiExtractor>): Promise<string[]> {
  let workspace = emptyWorkspace()
  for (const message of testCase.messages) {
    workspace = (await runPipeline(workspace, { text: message, userReferenceDate: null }, extractor, () => undefined, { now: evalNow })).workspace
  }
  return testCase.expect.flatMap((expectation) => check(workspace, expectation))
}

async function main() {
  const extractor = createOpenAiExtractor(env.openaiApiKey as string, env.model)
  const selected = cases.filter((testCase) => !only || testCase.name.includes(only))
  let passed = 0
  let total = 0

  for (const testCase of selected) {
    const results: string[][] = []
    for (let run = 0; run < runs; run += 1) results.push(await runCase(testCase, extractor))
    const good = results.filter((problems) => problems.length === 0).length
    passed += good
    total += runs
    console.log(`${good === runs ? '✓' : '✗'} ${testCase.name}${runs > 1 ? `  (${good}/${runs})` : ''}`)
    const firstFailure = results.find((problems) => problems.length > 0)
    firstFailure?.forEach((problem) => console.log(`     ${problem}`))
  }

  console.log(`\n${passed}/${total} עברו (${Math.round((passed / Math.max(total, 1)) * 100)}%), מודל ${env.model}`)
  process.exitCode = passed === total ? 0 : 1
}

main().catch((error) => {
  console.error('ההרצה נכשלה:', error instanceof Error ? error.message : error)
  process.exit(1)
})
