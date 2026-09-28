const palette = ['var(--green)', 'var(--red)', 'var(--primary)', 'var(--purple)', 'var(--orange)', 'var(--amber)']

// The same meeting always gets the same color, in the month grid and in the day list.
export function meetingColor(id: string): string {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return palette[hash % palette.length]
}
