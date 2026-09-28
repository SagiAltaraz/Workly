export interface TextRange {
  start: number
  end: number
}

// The text without the given ranges. Used to keep a sentence that was handled as an instruction
// away from the agents that read information, so it is never read twice.
export function removeRanges(text: string, ranges: TextRange[]): string {
  let result = ''
  let cursor = 0
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    if (range.start < cursor) continue
    result += text.slice(cursor, range.start)
    cursor = range.end
  }
  return `${result}${text.slice(cursor)}`.replace(/\n{3,}/g, '\n\n').trim()
}
