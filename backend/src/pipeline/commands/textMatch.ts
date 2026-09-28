const stopWords = new Set(['את', 'של', 'עם', 'על', 'אל', 'זה', 'או', 'גם', 'לי'])
const prefixLetters = new Set(['ה', 'ו', 'ב', 'ל', 'מ', 'כ', 'ש'])

// A rough Hebrew stem: drop one leading prefix letter and unify a final ת/ה
// ("פגישת" and "פגישה"), so the same item is found however the sentence bends it.
function stem(token: string): string {
  let word = token
  if (word.length > 3 && prefixLetters.has(word[0])) word = word.slice(1)
  if (word.length > 3 && word.endsWith('ת')) word = `${word.slice(0, -1)}ה`
  return word
}

export function contentTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 1 && !stopWords.has(token))
      .map(stem),
  )
}

// Share of the words the person used that appear in the candidate.
export function matchScore(query: string, candidate: string): number {
  const wanted = contentTokens(query)
  if (wanted.size === 0) return 0
  const have = contentTokens(candidate)
  let shared = 0
  for (const token of wanted) if (have.has(token)) shared += 1
  return shared / wanted.size
}

export interface Candidate {
  id: string
  text: string
  label: string
}

const minimumScore = 0.5
const closeEnough = 0.2

// The best candidates for the words the person used. One clear winner is acted on; several close
// ones are handed back so the person can choose. Nothing below the minimum is ever guessed.
export function findMatches(candidates: Candidate[], query: string): Candidate[] {
  const ranked = candidates
    .map((candidate) => ({ candidate, score: matchScore(query, candidate.text) }))
    .filter((entry) => entry.score >= minimumScore)
    .sort((a, b) => b.score - a.score)
  if (ranked.length === 0) return []
  const best = ranked[0].score
  return ranked.filter((entry) => entry.score >= best - closeEnough).map((entry) => entry.candidate)
}
