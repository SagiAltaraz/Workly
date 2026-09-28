export type SegmentKind = 'brief' | 'tasks' | 'meetings' | 'unknown'

export interface Segment {
  kind: SegmentKind
  text: string
}

export interface RoutedText {
  brief: string
  tasks: string
  meetings: string
}

const maxHeadingLength = 45

function headingKind(line: string): SegmentKind | null {
  const trimmed = line.trim()
  if (trimmed.length === 0 || trimmed.length > maxHeadingLength || trimmed.startsWith('-')) return null
  if (/פגישות/.test(trimmed)) return 'meetings'
  if (/משימות/.test(trimmed)) return 'tasks'
  if (/בריף/.test(trimmed)) return 'brief'
  return null
}

// Splits the text at short heading lines. Text before the first heading, or a text with no
// recognizable heading at all, is 'unknown' and goes to every agent.
export function classify(text: string): Segment[] {
  const segments: Segment[] = []
  let kind: SegmentKind = 'unknown'
  let lines: string[] = []

  const flush = () => {
    const body = lines.join('\n').trim()
    if (body.length > 0) segments.push({ kind, text: body })
    lines = []
  }

  for (const line of text.split('\n')) {
    const found = headingKind(line)
    if (found) {
      flush()
      kind = found
    }
    lines.push(line)
  }
  flush()
  return segments
}

function joinKinds(segments: Segment[], kinds: SegmentKind[]): string {
  return segments
    .filter((segment) => kinds.includes(segment.kind))
    .map((segment) => segment.text)
    .join('\n\n')
}

// Meetings can hide inside a task list, so the meetings agent also reads the task segments.
export function routeSegments(segments: Segment[]): RoutedText {
  return {
    brief: joinKinds(segments, ['brief', 'unknown']),
    tasks: joinKinds(segments, ['tasks', 'unknown']),
    meetings: joinKinds(segments, ['meetings', 'tasks', 'unknown']),
  }
}

export function describeSegments(segments: Segment[]): string {
  const names: Record<SegmentKind, string> = {
    brief: 'בריף',
    tasks: 'משימות',
    meetings: 'פגישות',
    unknown: 'טקסט לא מסווג',
  }
  return segments.map((segment) => names[segment.kind]).join(', ')
}
