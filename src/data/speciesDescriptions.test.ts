import { describe, expect, it } from 'vitest'

import { speciesDescriptions } from './speciesDescriptions'

describe('speciesDescriptions', () => {
  it('is a non-empty list of entries with a name, scientific name, and description', () => {
    expect(speciesDescriptions.length).toBeGreaterThan(0)
    for (const entry of speciesDescriptions) {
      expect(entry.commonName).toBeTruthy()
      expect(entry.scientificName).toBeTruthy()
      expect(entry.description).toBeTruthy()
    }
  })

  it('has no duplicate scientific names', () => {
    const names = speciesDescriptions.map((entry) => entry.scientificName.trim().toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })
})
