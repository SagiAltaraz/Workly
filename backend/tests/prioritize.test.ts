import { describe, expect, it } from 'vitest'
import { prioritizeTask } from '../src/pipeline/prioritize'
import { makeTask } from './helpers'

const ref = '2026-09-23'

describe('prioritize — rules, first match wins', () => {
  it('blocked wins over everything, even a P1-looking task', () => {
    const task = prioritizeTask(
      makeTask({
        dueDate: ref,
        dueTime: '16:00',
        signals: { condition: 'רק אם התקבל אישור', urgency: 'דחוף' },
      }),
      ref,
    )
    expect(task.rule).toBe('blocked')
    expect(task.blocked).toBe(true)
    expect(task.priority).toBeNull()
  })

  it('P1 needs due today, a hard time and a strong signal', () => {
    for (const signals of [
      { urgency: 'הכי דחוף' },
      { externalWaiting: 'הוא מחכה' },
      { blocksOthers: 'חוסם את העיצוב' },
    ]) {
      const task = prioritizeTask(makeTask({ dueDate: ref, dueTime: '11:00', signals }), ref)
      expect(task.rule).toBe('p1Critical')
      expect(task.priority).toBe('p1')
      expect(task.bucket).toBe('today')
    }
  })

  it('urgent wording alone on a task due tomorrow is not P1', () => {
    const task = prioritizeTask(
      makeTask({ dueDate: '2026-09-24', dueTime: '11:00', signals: { urgency: 'דחוף' } }),
      ref,
    )
    expect(task.rule).toBe('p4Later')
    expect(task.bucket).toBe('tomorrow')
  })

  it('a plain "important" without a hard time is P2, not P1', () => {
    const task = prioritizeTask(makeTask({ dueDate: ref, signals: { urgency: 'חשוב' } }), ref)
    expect(task.rule).toBe('p2Today')
  })

  it('an explicit "urgent" or "the most important" is critical today even without an hour', () => {
    for (const urgency of ['דחוף', 'זה הכי חשוב', 'חשוב מאוד', 'קריטי', 'לא לדחות']) {
      const task = prioritizeTask(makeTask({ dueDate: ref, signals: { urgency } }), ref)
      expect(task.rule, urgency).toBe('p1Critical')
      expect(task.reason).toContain('דחוף מאוד')
    }
  })

  it('strong urgency on a task for tomorrow is still not P1', () => {
    expect(prioritizeTask(makeTask({ dueDate: '2026-09-24', signals: { urgency: 'דחוף' } }), ref).rule).toBe('p4Later')
  })

  it('"not urgent" cancels strong urgency wording', () => {
    expect(prioritizeTask(makeTask({ dueDate: ref, signals: { urgency: 'דחוף', notUrgent: 'לא דחוף' } }), ref).rule).not.toBe('p1Critical')
  })

  it('P3 is checked before P2', () => {
    const task = prioritizeTask(
      makeTask({ dueDate: ref, signals: { canWait: 'tomorrow', listedUnder: 'today' } }),
      ref,
    )
    expect(task.rule).toBe('p3CanSlip')
    expect(task.priority).toBe('p3')
    expect(task.bucket).toBe('today')
  })

  it('P2 covers a hard or soft deadline today', () => {
    expect(prioritizeTask(makeTask({ dueDate: ref, dueTime: '15:00' }), ref).rule).toBe('p2Today')
    expect(prioritizeTask(makeTask({ dueDate: ref }), ref).rule).toBe('p2Today')
  })

  it('a task listed under "today" with no date is due today', () => {
    const task = prioritizeTask(makeTask({ signals: { listedUnder: 'today' } }), ref)
    expect(task.rule).toBe('p2Today')
    expect(task.bucket).toBe('today')
  })

  it('a task the text calls not urgent is P4 even under "today", and can move to the week', () => {
    const task = prioritizeTask(
      makeTask({ signals: { listedUnder: 'today', notUrgent: 'לא דחוף', canWait: 'laterThisWeek' } }),
      ref,
    )
    expect(task.rule).toBe('p4Later')
    expect(task.bucket).toBe('week')
  })

  it('P4 is anything due after today', () => {
    const task = prioritizeTask(makeTask({ dueDate: '2026-09-28' }), ref)
    expect(task.rule).toBe('p4Later')
    expect(task.bucket).toBe('week')
  })

  it('explains every result in words', () => {
    expect(prioritizeTask(makeTask({ dueDate: ref, dueTime: '11:00', signals: { urgency: 'x' } }), ref).reason).toContain('11:00')
    expect(prioritizeTask(makeTask({ signals: { condition: 'אם יאשרו' } }), ref).reason).toContain('אם יאשרו')
  })
})

describe('prioritize — buckets', () => {
  it('splits the coming days into tomorrow and the rest of the week', () => {
    expect(prioritizeTask(makeTask({ dueDate: '2026-09-24' }), ref).bucket).toBe('tomorrow')
    expect(prioritizeTask(makeTask({ dueDate: '2026-09-25' }), ref).bucket).toBe('week')
    expect(prioritizeTask(makeTask({ dueDate: '2026-09-30' }), ref).bucket).toBe('week')
  })

  it('week is a rolling seven days after the reference date', () => {
    expect(prioritizeTask(makeTask({ dueDate: '2026-09-30' }), ref).bucket).toBe('week')
    expect(prioritizeTask(makeTask({ dueDate: '2026-10-01' }), ref).bucket).toBe('later')
  })

  it('a listed-under-week task without a date lands in the week', () => {
    expect(prioritizeTask(makeTask({ signals: { listedUnder: 'week' } }), ref).bucket).toBe('week')
  })

  it('everything else is later', () => {
    expect(prioritizeTask(makeTask({ dueDate: '2026-11-01' }), ref).bucket).toBe('later')
    expect(prioritizeTask(makeTask(), ref).bucket).toBe('later')
  })
})
