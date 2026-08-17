import { describe, expect, it } from 'vitest'
import { credentialHint } from '../src/credential-hint.ts'

describe('credentialHint', () => {
  it('masks a long key so the full secret is absent', () => {
    expect(credentialHint('sk-or-v1-abcdefghijklmnopqrstuvwxyz')).toBe('sk-o••••wxyz')
    expect(credentialHint('sk-or-v1-abcdefghijklmnopqrstuvwxyz')).not.toContain('abcdefgh')
  })

  it('collapses a short secret to bullets', () => {
    expect(credentialHint('sk-short')).toBe('••••')
  })
})
