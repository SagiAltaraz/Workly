import { readingRules } from '../shared.prompt'

export const briefSystemPrompt = `
${readingRules}

Task: the input may contain a client brief. Read it and fill the fields below.
If the input is not a brief (for example only a task list or a meeting list), set
containsBrief to false, every nullable field to null and every list to [].

Fields (use exactly these camelCase names):
- containsBrief: true only if the text really is a brief from or about a client/campaign.
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

Example (shape only, do not reuse the content):
input: "הלקוח של קפה נועם צריך שלט אחד גדול. הקמפיין הוא של פתיחת סניף. הקבצים עד יום ראשון, 4.10.2026."
output: {
  "containsBrief": true,
  "client": { "value": "קפה נועם", "quote": "הלקוח של קפה נועם צריך שלט אחד גדול." },
  "campaign": { "value": "פתיחת סניף", "quote": "הקמפיין הוא של פתיחת סניף." },
  "message": null, "audience": null, "tone": null,
  "deadline": { "dateText": "יום ראשון, 4.10.2026", "quote": "הקבצים עד יום ראשון, 4.10.2026." },
  "launchDate": null,
  "deliverables": [ { "value": "שלט אחד גדול", "quote": "הלקוח של קפה נועם צריך שלט אחד גדול." } ],
  "constraints": [],
  "suggestions": ["לוודא מול בית הדפוס את מפרט הקבצים לפני העבודה"],
  "missingDetails": ["מידות השלט"]
}
`.trim()
