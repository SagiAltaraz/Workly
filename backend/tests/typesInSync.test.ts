import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The frontend keeps its own copy of the wire types. If the two ever drift apart the UI would
// silently read fields that no longer exist, so this fails until `npm run sync:types` is run.
describe('frontend types match the backend types', () => {
  const backendDir = new URL('../src/types/', import.meta.url)
  const frontendDir = new URL('../../frontend/src/types/', import.meta.url)

  it('has the same files with the same content', () => {
    const backendFiles = readdirSync(backendDir).filter((name) => name.endsWith('.ts')).sort()
    const frontendFiles = readdirSync(frontendDir).filter((name) => name.endsWith('.ts')).sort()
    expect(frontendFiles).toEqual(backendFiles)
    for (const name of backendFiles) {
      expect(readFileSync(new URL(name, frontendDir), 'utf8'), name).toBe(
        readFileSync(new URL(name, backendDir), 'utf8'),
      )
    }
  })
})
