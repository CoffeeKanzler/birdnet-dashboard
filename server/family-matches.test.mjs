import { describe, expect, it } from 'vitest'

import { hasFamilyIntersection, tokenizeFamilyLabel } from './family-matches.mjs'

describe('family match tokenizer', () => {
  it('splits family labels by separators and conjunction words', () => {
    expect(tokenizeFamilyLabel('Drosseln and Spottdrosseln / Finken; Ammern')).toEqual([
      'drosseln',
      'spottdrosseln',
      'finken',
      'ammern',
    ])
    expect(tokenizeFamilyLabel('Meisen und Kleiber')).toEqual(['meisen', 'kleiber'])
  })

  it('normalizes diacritics and removes duplicates', () => {
    expect(tokenizeFamilyLabel('Eisvögel, eisvogel')).toEqual(['eisvogel'])
  })
})

describe('family intersection', () => {
  it('matches when any token overlaps', () => {
    expect(hasFamilyIntersection(['drosseln', 'ammern'], ['finken', 'drosseln'])).toBe(true)
  })

  it('returns false for empty or disjoint token lists', () => {
    expect(hasFamilyIntersection([], ['drosseln'])).toBe(false)
    expect(hasFamilyIntersection(['meisen'], ['drosseln'])).toBe(false)
  })
})
