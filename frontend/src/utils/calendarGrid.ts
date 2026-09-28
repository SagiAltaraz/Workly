import { addDays, partsOf, toIso, weekdayIndex } from './isoDate'

export interface GridDay {
  iso: string
  inMonth: boolean
}

// Whole weeks, Sunday first, always covering the month. In an RTL page the first cell of each
// row lands on the right, which is where a Hebrew calendar starts.
export function monthGrid(year: number, month: number): GridDay[] {
  const first = toIso({ year, month, day: 1 })
  const start = addDays(first, -weekdayIndex(first))
  const days: GridDay[] = []
  for (let index = 0; index < 42; index += 1) {
    const iso = addDays(start, index)
    days.push({ iso, inMonth: partsOf(iso).month === month })
  }
  const lastWeekHasMonthDays = days.slice(35).some((day) => day.inMonth)
  return lastWeekHasMonthDays ? days : days.slice(0, 35)
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}
