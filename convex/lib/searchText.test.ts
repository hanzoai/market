/* @vitest-environment node */

import { describe, expect, it } from 'vitest'
import { __test, matchesExactTokens, tokenize } from './searchText'

describe('searchText', () => {
  it('tokenize lowercases and splits on punctuation', () => {
    expect(tokenize('Minimax Usage /minimax-usage')).toEqual([
      'minimax',
      'usage',
      'minimax',
      'usage',
    ])
  })

  it('matchesExactTokens requires at least one query token', () => {
    const queryTokens = tokenize('Remind Me')
    expect(matchesExactTokens(queryTokens, ['Remind Me', '/remind-me', 'Short summary'])).toBe(true)
    // "Reminder" contains "remind" as a substring but tokenizes to "reminder", not "remind"
    // However "remind" is not in the text, but we still match because vector search handles relevance
    expect(matchesExactTokens(queryTokens, ['Reminder tool', '/reminder', 'Short summary'])).toBe(
      false,
    )
    // Matches because "remind" token is present
    expect(matchesExactTokens(queryTokens, ['Remind tool', '/remind', 'Short summary'])).toBe(true)
    // No matching tokens at all
    expect(matchesExactTokens(queryTokens, ['Other tool', '/other', 'Short summary'])).toBe(false)
  })

  it('matchesExactTokens ignores empty inputs', () => {
    expect(matchesExactTokens([], ['text'])).toBe(false)
    expect(matchesExactTokens(['token'], ['  ', null, undefined])).toBe(false)
  })

  it('normalize uses lowercase', () => {
    expect(__test.normalize('AbC')).toBe('abc')
  })
})
