import type { BriefFieldKey } from '../types/brief'
import type { FactStatus } from '../types/provenance'
import type { PriorityTier } from '../types/task'
import type { Stage } from '../types/pipeline'
import type { ColumnId } from './buildBoard'

export const statusLabels: Record<FactStatus, string> = {
  stated: 'נאמר',
  inferred: 'הוסק',
  assumed: 'הנחה',
  missing: 'חסר',
}

export const statusHints: Record<FactStatus, string> = {
  stated: 'כתוב בטקסט כמו שהוא',
  inferred: 'חושב בקוד מתוך מילים שכתובות בטקסט',
  assumed: 'הצעה מקצועית של המערכת, לא מהטקסט',
  missing: 'נדרש ולא מופיע בטקסט. הפך לשאלה',
}

export const priorityLabels: Record<PriorityTier, string> = {
  p1: 'קריטי · P1',
  p2: 'היום · P2',
  p3: 'יכול לחכות · P3',
  p4: 'בהמשך · P4',
}

export const briefFieldLabels: Record<BriefFieldKey, string> = {
  client: 'לקוח',
  campaign: 'קמפיין',
  message: 'מסר',
  audience: 'קהל יעד',
  tone: 'טון',
  deadline: 'מועד הגשה',
  launchDate: 'עליית הקמפיין',
}

export const briefDateKeys: BriefFieldKey[] = ['deadline', 'launchDate']

export const stageLabels: Record<Stage, string> = {
  normalize: 'מנקה ומאחד את הטקסט',
  detectReferenceDate: 'מזהה תאריך ייחוס',
  extractCommands: 'מזהה הוראות (עריכה, מחיקה, הוספה)',
  classify: 'מסווג בריף, משימות ופגישות',
  extractBrief: 'קורא את הבריף',
  extractTasks: 'קורא משימות',
  extractMeetings: 'קורא פגישות',
  validate: 'מאמת ציטוטים מול הטקסט',
  merge: 'ממזג עם מה שכבר ידוע',
  prioritize: 'מחשב עדיפויות ומחפש חפיפות',
}

export const stageOrder: Stage[] = [
  'normalize',
  'detectReferenceDate',
  'extractCommands',
  'classify',
  'extractBrief',
  'extractTasks',
  'extractMeetings',
  'validate',
  'merge',
  'prioritize',
]

export const columnTitles: Record<ColumnId, string> = {
  today: 'היום',
  week: 'השבוע הקרוב',
  blocked: 'ממתין',
  done: 'הושלם',
  later: 'בהמשך',
}
