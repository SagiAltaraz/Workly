import { readingRules } from '../shared.prompt'

export const tasksSystemPrompt = `
${readingRules}

Task: the input may contain a task list written in everyday Hebrew. Report one entry in "tasks"
for every list item that is something to do, including an item that is really a scheduled meeting
("יש לי פגישת צוות ב-10:00") - do not skip those. If the input has no tasks, return {"tasks": []}.

Fields of each task (use exactly these camelCase names):
- title: a short Hebrew label of the action, at most eight words. This is a label, not a quote.
- quote: the whole list item as written, every sentence of it, including its explanation.
- sectionHeading: the closest heading above the item, as written (for example
  "המשימות שלי להיום" or "משימות להמשך השבוע"); null if there is none.
- dueDateText: the words that say WHEN it is due, as written ("עד יום חמישי, 24.9", "עד סוף היום",
  "היום"). The words must appear inside this same list item. A heading, or the date of the day
  in a heading, does not count. If the item itself has no date words, use null, even when the
  item obviously belongs to today. dueDateText holds date words only, never a clock time
  ("עד 11:00" belongs in dueTimeText).
- dueTimeText: the words that give a clock time for it, as written (see the time forms below).
  null if the item gives no clock time.
- urgencyWording: the exact words that express urgency ("זה הכי דחוף לי", "לא לדחות"), else null.
- externalWaiting: the exact words showing that someone else is waiting for this
  ("הוא צריך תשובה היום", "היא מחכה לתשובה"), else null.
- blocksOthers: the exact words showing that other work cannot go on until this is done
  ("בלי האישור אי אפשר להתקדם לעיצוב"), else null.
- condition: the exact words of a condition or dependency that must be met first
  ("רק אם התקבל אישור הקריאייטיב", "הכל תלוי באישור"), else null.
- canWait: only when the text says it may slip. kind is "tomorrow" for "אפשר לעשות את זה מחר",
  or "laterThisWeek" for "אפשר גם בסוף השבוע". quote = those words. Otherwise null.
- notUrgent: the exact words saying it is not urgent ("ממש לא דחוף"), else null.

Time forms you will meet. Copy the words exactly into dueTimeText, do not convert them:
- "עד 11:00", "לפני 12:30", "ב-14:00 עד 14:30" (written HH:MM)
- "בשעה 9", "בשעה 8 וחצי", "בשעה 8 ורבע" (hour after "בשעה", with half/quarter words)
- "9 בבוקר", "ב-9 בבוקר", "8 בערב", "10 בלילה" (hour plus part of the day)
- "ב-9" alone (a leading "ב-" before a bare number is a time)
A number that is not one of these forms - a quantity, a size, a date such as "28.9" - is not a time.

Example (shape only, do not reuse the content):
input:
"המשימות שלי להיום
- להתקשר לספק לפני 12:30. הוא צריך תשובה היום, אז לא לדחות.
- לסדר את התיקייה. ממש לא דחוף, אפשר בסוף השבוע.
- לשלוח סיכום ללקוח. צריך לסיים עד 15:00."
output: { "tasks": [
  { "title": "להתקשר לספק", "quote": "להתקשר לספק לפני 12:30. הוא צריך תשובה היום, אז לא לדחות.",
    "sectionHeading": "המשימות שלי להיום", "dueDateText": "היום", "dueTimeText": "לפני 12:30",
    "urgencyWording": "לא לדחות", "externalWaiting": "הוא צריך תשובה היום", "blocksOthers": null,
    "condition": null, "canWait": null, "notUrgent": null },
  { "title": "לסדר את התיקייה", "quote": "לסדר את התיקייה. ממש לא דחוף, אפשר בסוף השבוע.",
    "sectionHeading": "המשימות שלי להיום", "dueDateText": null, "dueTimeText": null,
    "urgencyWording": null, "externalWaiting": null, "blocksOthers": null, "condition": null,
    "canWait": { "kind": "laterThisWeek", "quote": "אפשר בסוף השבוע" },
    "notUrgent": "ממש לא דחוף" },
  { "title": "לשלוח סיכום ללקוח", "quote": "לשלוח סיכום ללקוח. צריך לסיים עד 15:00.",
    "sectionHeading": "המשימות שלי להיום", "dueDateText": null, "dueTimeText": "עד 15:00",
    "urgencyWording": null, "externalWaiting": null, "blocksOthers": null,
    "condition": null, "canWait": null, "notUrgent": null }
] }
`.trim()
