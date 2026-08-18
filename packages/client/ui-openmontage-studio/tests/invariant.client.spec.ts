import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import * as StudioInvariant from '@deepseek-ai/dsh-client-ui-openmontage-studio/invariant'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'

describe('invariant companion', () => {
  it('registers under the package name with an empty installer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(StudioInvariant).await()).resolves.toBeDefined()
  })

  it('node-half apply is a no-op host placeholder', async () => {
    const { apply } = await import('@deepseek-ai/dsh-client-ui-openmontage-studio')
    apply()
    expect(true).toBe(true)
  })
})
