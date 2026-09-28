export class NotFoundError extends Error {}
export class ValidationError extends Error {}
export class NoModelConfiguredError extends Error {
  constructor() {
    super('לא הוגדר מודל (חסר OPENAI_API_KEY), ולכן אי אפשר לחלץ מידע מטקסט חדש.')
  }
}
