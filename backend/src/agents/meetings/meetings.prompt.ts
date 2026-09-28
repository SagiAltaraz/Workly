import { readingRules } from '../shared.prompt'

export const meetingsSystemPrompt = `
${readingRules}

Task: find every meeting, call or session in the input, including one written as an item in a task
list ("יש לי פגישת צוות ב-10:00 עד 10:20"). A meeting with no agreed time is still a meeting: report
it with the missing fields set to null. If the input has no meetings, return {"meetings": []}.

Fields of each meeting (use exactly these camelCase names):
- topic: a short Hebrew label of what the meeting is about. A label, not a quote.
- quote: the whole item that describes the meeting, as written.
- sectionHeading: the closest heading above it, as written, or null.
- weekdayText: the weekday words as written ("יום חמישי"), or null if none is written.
- dateText: the date words as written ("24.9.2026", "מחר"), or null if none is written. Do not
  compute a date from a weekday, and do not use the date of a heading.
- timeText: the clock-time words as written (see the time forms below), or null.
- participants: people or roles named as attending, as written ("יעל", "דנה", "המעצבת"); [] if none.

Time forms you will meet. Copy the words exactly into timeText, do not convert them:
- "מ-09:30 עד 10:00", "ב-14:00 עד 14:30" (written HH:MM, a range or a single time)
- "בשעה 9", "בשעה 8 וחצי", "בשעה 8 ורבע"
- "9 בבוקר", "ב-9 בבוקר", "8 בערב", "10 בלילה"
- "ב-9" alone (a leading "ב-" before a bare number is a time)
A number that is not one of these forms - a quantity, a size, a date such as "28.9" - is not a time.

Example (shape only, do not reuse the content):
input: "- ביום שלישי, 6.10.2026, מ-12:00 עד 12:30, היכרות עם ספק חדש.
- נפגש עם דנה בשבוע הבא, עוד לא סגרנו שעה."
output: { "meetings": [
  { "topic": "היכרות עם ספק חדש",
    "quote": "ביום שלישי, 6.10.2026, מ-12:00 עד 12:30, היכרות עם ספק חדש.",
    "sectionHeading": null, "weekdayText": "יום שלישי", "dateText": "6.10.2026",
    "timeText": "מ-12:00 עד 12:30", "participants": [] },
  { "topic": "פגישה עם דנה",
    "quote": "נפגש עם דנה בשבוע הבא, עוד לא סגרנו שעה.",
    "sectionHeading": null, "weekdayText": null, "dateText": null, "timeText": null,
    "participants": ["דנה"] }
] }
`.trim()
