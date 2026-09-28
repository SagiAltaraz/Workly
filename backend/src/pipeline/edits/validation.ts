import { ValidationError } from '../../errors'
import { isValidCalendarDate } from '../dateMath'

export function assertDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match || !isValidCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
    throw new ValidationError('תאריך חייב להיות בפורמט YYYY-MM-DD ותקין')
  }
  return value
}

export function assertTime(value: string): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new ValidationError('שעה חייבת להיות בפורמט HH:MM')
  return value
}

export function assertText(value: string, what: string): string {
  const cleaned = value.trim()
  if (cleaned.length === 0) throw new ValidationError(`${what} לא יכול להיות ריק`)
  return cleaned
}

export function shownValue(value: string | null): string {
  return value ?? 'ללא'
}
