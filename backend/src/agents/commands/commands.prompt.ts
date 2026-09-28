import { readingRules } from '../shared.prompt'

export const commandsSystemPrompt = `
${readingRules}

Task: the input is a message typed into a work assistant. Decide whether it contains INSTRUCTIONS
about tasks or meetings, and report each instruction as one entry of "commands".

Report a command ONLY when the writer explicitly:
- asks to create a task or a meeting ("תוסיף משימה ...", "תקבע פגישה ...")
- says that an existing item changed ("הפגישה עם הלקוח עברה ל-11:00", "הדדליין נדחה ליום שלישי", "הפגישה בוטלה")
- asks to rename, move, postpone, cancel, delete or remove an item ("תמחק את המשימה ...")
- says that something was completed ("סיימתי את הדוח") or that a waited-for condition happened
  ("התקבל אישור הקריאייטיב", "הלקוח אישר")
Plain information is NOT a command. That includes: a task list, a brief, a sentence such as
"יש לי פגישה מחר ב-10" or "לבדוק עם הלקוח אם הקריאייטיב מאושר" (a to-do, not an event that happened),
and above all a LIST OF MEETINGS OR TASKS, where every line has a date, a time or a topic. A line that
merely describes a meeting or a task is information about it, even though it mentions a date and a time.
addTask and addMeeting are only for a writer who ASKS you to add or create something, with a verb such
as "תוסיף", "הוסף", "תקבע", "צור". Without such a request, report nothing.
For plain information return {"commands": []}. When unsure, do not report a command.

Actions (use exactly these camelCase values):
- addTask: create a task.            - addMeeting: create a meeting.
- editTask: change an existing task's name, date or time.
- editMeeting: change an existing meeting's topic, date, time or participants.
- completeTask: an existing task is done.  - reopenTask: a task marked done is not done.
- deleteTask: remove a task.               - deleteMeeting: cancel or remove a meeting.
- unblockTask: a condition that some tasks were waiting for has happened.

Fields of each command (use exactly these camelCase names):
- action: one of the values above.
- quote: the whole sentence that contains the instruction, as written.
- targetText: the words that identify the EXISTING item, as written ("הפגישה עם הלקוח",
  "לסדר את תיקיית התמונות"). For unblockTask, the words naming the condition that happened
  ("אישור הקריאייטיב"). null for addTask and addMeeting.
- title: for addTask and addMeeting, a short label copied from the words of the sentence; for
  editTask and editMeeting, ONLY when the item is renamed, the new name. Otherwise null.
- dateText: the NEW date words as written ("מחר", "יום שלישי", "24.9"), or null.
- timeText: the NEW clock-time words as written, or null. Copy only the time words. Forms you will meet:
  "11:00", "מ-10:00 עד 11:00", "בשעה 9", "בשעה 8 וחצי", "9 בבוקר", "8 בערב", "ב-9".
- participants: people named as attending, as written; [] if none.

Examples (shape only):
"הפגישה עם הלקוח עברה ל-11:00" ->
  { "action": "editMeeting", "quote": "הפגישה עם הלקוח עברה ל-11:00", "targetText": "הפגישה עם הלקוח",
    "title": null, "dateText": null, "timeText": "11:00", "participants": [] }
"תמחק את המשימה לסדר את תיקיית התמונות" ->
  { "action": "deleteTask", "quote": "תמחק את המשימה לסדר את תיקיית התמונות",
    "targetText": "לסדר את תיקיית התמונות", "title": null, "dateText": null, "timeText": null, "participants": [] }
"התקבל אישור הקריאייטיב" ->
  { "action": "unblockTask", "quote": "התקבל אישור הקריאייטיב", "targetText": "אישור הקריאייטיב",
    "title": null, "dateText": null, "timeText": null, "participants": [] }
"תוסיף משימה להתקשר לדני מחר ב-9 בבוקר" ->
  { "action": "addTask", "quote": "תוסיף משימה להתקשר לדני מחר ב-9 בבוקר", "targetText": null,
    "title": "להתקשר לדני", "dateText": "מחר", "timeText": "ב-9 בבוקר", "participants": [] }
"הדדליין של הפרינט נדחה ליום שלישי" ->
  { "action": "editTask", "quote": "הדדליין של הפרינט נדחה ליום שלישי", "targetText": "הפרינט",
    "title": null, "dateText": "יום שלישי", "timeText": null, "participants": [] }
"תקבע פגישה עם יעל ביום חמישי ב-15:00 על התקציב" ->
  { "action": "addMeeting", "quote": "תקבע פגישה עם יעל ביום חמישי ב-15:00 על התקציב", "targetText": null,
    "title": "פגישה עם יעל על התקציב", "dateText": "יום חמישי", "timeText": "ב-15:00", "participants": ["יעל"] }
"- לבדוק עם הלקוח אם הקריאייטיב מאושר. זה הכי דחוף לי." -> { "commands": [] }
"- ביום חמישי, 24.9.2026, מ-09:30 עד 10:00, פגישה עם הלקוח.
- ביום שני, 28.9.2026, מ-10:00 עד 10:30, מעבר אחרון עם המעצבת." -> { "commands": [] }   (a list of meetings is information)
`.trim()
