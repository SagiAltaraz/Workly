import { readingRules } from '../shared.prompt'

export const tasksSystemPrompt = `
${readingRules}

Task: the input may contain a task list written in everyday Hebrew. Report one entry in "tasks"
for everything the writer has TO DO: an action with a verb ("להתקשר", "להכין", "לבדוק"). If the input
has no tasks, return {"tasks": []}.

Meetings are NOT tasks. A sentence that only says a meeting is scheduled ("יש לי היום פגישה ב-20:00 עם
שגיא", "ב-14:00 יש לי פגישה עם המעצבת") belongs to another agent: do not report it. But preparing for a
meeting IS a task ("להכין חומרים לפגישה עם שגיא"), and so is a to-do that shares a list item with a
meeting ("... לבדוק לפני כן אם הגיע אישור"). For such an item report only the to-do, and let "quote"
be the sentence that holds the to-do, not the sentence about the meeting.

Fields of each task (use exactly these camelCase names):
- title: a short Hebrew label of the action, at most eight words. This is a label, not a quote, so fix
  obvious spelling mistakes in it, but keep names of people and companies exactly as written.
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
- relatedMeetingText: when the task is done FOR a meeting, the exact words naming that meeting
  ("לפגישה עם שגיא", "לפגישה עם המעצבת"). null when the task has no meeting behind it.

Time forms you will meet. Copy the words exactly into dueTimeText, do not convert them:
- "עד 11:00", "לפני 12:30", "ב-14:00 עד 14:30" (written HH:MM)
- "בשעה 9", "בשעה 8 וחצי", "בשעה 8 ורבע" (hour after "בשעה", with half/quarter words)
- "9 בבוקר", "ב-9 בבוקר", "8 בערב", "10 בלילה" (hour plus part of the day)
- "ב-9" alone (a leading "ב-" before a bare number is a time)
- hours in words: "שמונה וחצי בערב", "בעשר", "רבע לשמונה", "עשרה לתשע"
- "עד הצהריים" (until noon), even when misspelled ("עד הצהרים")
- a wait from now: "עוד שעה", "בעוד שעתיים", "עוד חצי שעה", "עוד 20 דקות"
- a part of the day with no hour: "בבוקר", "אחה"צ", "בערב". Copy it too; the code knows it is a window.
A number that is not one of these forms - a quantity, a size, a date such as "28.9" - is not a time.
Copy date and time words exactly as written, spelling slips included ("מחרר", "חמשי"): the code reads them.

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

Example with a spelling slip (shape only): for "לשלוח חשבוניות ללוקוח מחר" the title is
"לשלוח חשבוניות ללקוח" (the slip is fixed) while "quote" stays "לשלוח חשבוניות ללוקוח מחר" exactly as typed.

Example with a meeting (shape only):
input:
"יש לי היום פגישה ב-20:00 עם נועה.
הכי חשוב להכין חומרים לפגישה עם נועה."
output: { "tasks": [
  { "title": "להכין חומרים לפגישה עם נועה", "quote": "הכי חשוב להכין חומרים לפגישה עם נועה.",
    "sectionHeading": null, "dueDateText": null, "dueTimeText": null,
    "urgencyWording": "הכי חשוב", "externalWaiting": null, "blocksOthers": null,
    "condition": null, "canWait": null, "notUrgent": null,
    "relatedMeetingText": "לפגישה עם נועה" }
] }
The first sentence is a meeting, so it is not reported. In every other example above,
"relatedMeetingText" is null.
`.trim()
