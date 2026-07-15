import { describe, expect, it } from 'vitest'

import { notableSpecies } from './notableSpecies'

describe('notableSpecies', () => {
  it('is a non-empty list where every entry has a description', () => {
    expect(notableSpecies.length).toBeGreaterThan(0)
    for (const entry of notableSpecies) {
      expect(entry.description).toBeTruthy()
    }
  })

  it('keeps an entry\'s own description when it already has one', () => {
    const withOwnDescription = notableSpecies.find(
      (entry) => entry.scientificName === 'Bombycilla garrulus',
    )
    expect(withOwnDescription?.description).toBe(
      'Eleganter Wintergast mit auffaelligen roten Fluegelspitzen.',
    )
  })

})
