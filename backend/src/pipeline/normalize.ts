const fromCodes = (...codes: number[]) => codes.map((code) => String.fromCodePoint(code)).join('')
const toRange = (first: number, last: number) =>
  Array.from({ length: last - first + 1 }, (_, i) => first + i)

const invisibleMarks = new RegExp(
  `[${fromCodes(0x200e, 0x200f, 0xfeff, ...toRange(0x202a, 0x202e), ...toRange(0x2066, 0x2069))}]`,
  'g',
)
const oddSpaces = new RegExp(`[${fromCodes(0xa0, 0x2007, 0x202f, 0x09)}]`, 'g')
const dashes = new RegExp(`[${fromCodes(0x5be, 0x2212, ...toRange(0x2010, 0x2015))}]`, 'g')
const doubleQuotes = new RegExp(`[${fromCodes(0x5f4, 0x201c, 0x201d)}]`, 'g')
const singleQuotes = new RegExp(`[${fromCodes(0x5f3, 0x2018, 0x2019)}]`, 'g')
const bullets = /[•·▪●◦]/g

// Spans are offsets into the normalized text, so this runs exactly once, before anything
// else, and the normalized string is what gets stored as the source.
export function normalizeText(raw: string): string {
  return raw
    .replace(invisibleMarks, '')
    .replace(/\r\n?/g, '\n')
    .replace(oddSpaces, ' ')
    .replace(dashes, '-')
    .replace(doubleQuotes, '"')
    .replace(singleQuotes, "'")
    .replace(bullets, '-')
    .replace(/ {2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
