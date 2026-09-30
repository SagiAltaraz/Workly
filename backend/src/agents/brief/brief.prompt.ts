import { readingRules } from '../shared.prompt'

export const briefSystemPrompt = `
${readingRules}

Task: the input may contain one or more client briefs. Report one entry in "briefs" for each
SEPARATE brief you find - a paragraph about a different client, or a different campaign, is a
different brief, even when several are pasted into the same message one after another. If the
input holds no brief at all (for example only a task list or a meeting list), return
{"briefs": []}. Never merge two different clients' or campaigns' facts into one entry.

Fields of each brief (use exactly these camelCase names):
- client: the client or brand name as written. value = the name only.
- campaign: which campaign this is, as written.
- message: the campaign message or slogan, as written.
- audience: the target audience, as written.
- tone: the requested tone, as written.
- deadline: the date by which the work must be delivered. dateText = the date words as
  written (for example "יום שני, 28.9.2026"), quote = the sentence containing it.
- launchDate: the date the campaign goes live. dateText as written, quote = its sentence.
- deliverables: each separate thing that must be produced, one entry per thing. Keep sizes and
  quantities as written. Split "print and signs" into separate entries.
- constraints: conditions the work must meet (something that must appear in every item, a fixed
  date, which version of materials to use).
- suggestions: at most three short Hebrew professional defaults you would propose that the
  text does NOT state (for example confirming print specifications with the printing house).
  Never include a specific fact nobody could know: no numbers, prices, phone numbers, sizes.
- missingDetails: things the work needs that the text does not give (short Hebrew phrases, for
  example the exact opening hours to print, or the logo file). Only what is really needed.

For client, campaign, message, audience, tone, deliverables and constraints:
"value" is ONE contiguous excerpt copied from a single sentence, and "quote" is the whole
sentence or clause that contains it. "value" must appear inside "quote".
Never join two sentences into one value, never reorder words and never add words.
When a line has the form "label: content", the value is only the content after the colon.
Example: for the text "הפרינט: A4, דו-צדדי" the value is "A4, דו-צדדי" (not "פרינט A4, דו-צדדי").
Example: when the text says "שלט אחד גדול על הכביש. הגדול הוא 8 על 3 מטר", make two entries,
value "שלט אחד גדול על הכביש" and value "הגדול הוא 8 על 3 מטר", each with its own sentence as quote.
A deliverable, constraint, suggestion or missing detail belongs to the brief its own sentence is
part of - never attach it to a different brief just because both appeared in the same message.

Example with one brief (shape only, do not reuse the content):
input: "הלקוח של קפה נועם צריך שלט אחד גדול. הקמפיין הוא של פתיחת סניף. הקבצים עד יום ראשון, 4.10.2026."
output: { "briefs": [ {
  "client": { "value": "קפה נועם", "quote": "הלקוח של קפה נועם צריך שלט אחד גדול." },
  "campaign": { "value": "פתיחת סניף", "quote": "הקמפיין הוא של פתיחת סניף." },
  "message": null, "audience": null, "tone": null,
  "deadline": { "dateText": "יום ראשון, 4.10.2026", "quote": "הקבצים עד יום ראשון, 4.10.2026." },
  "launchDate": null,
  "deliverables": [ { "value": "שלט אחד גדול", "quote": "הלקוח של קפה נועם צריך שלט אחד גדול." } ],
  "constraints": [],
  "suggestions": ["לוודא מול בית הדפוס את מפרט הקבצים לפני העבודה"],
  "missingDetails": ["מידות השלט"]
} ] }

Example with two briefs pasted in one message (shape only): for
"בריף שקיבלתי\\nהלקוח של קפה נועם צריך שלט אחד גדול.\\nבריף שקיבלתי\\nהלקוח של מספרת דניאל צריך פליירים לפתיחה."
report TWO entries in "briefs": one with client "קפה נועם" and its own deliverable, a second with
client "מספרת דניאל" and its own deliverable - never one entry mixing both clients' deliverables.

Example with no brief: for a plain task list or meeting list, return {"briefs": []}.
`.trim()
