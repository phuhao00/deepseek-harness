/**
 * The ACP app's command-line provider: empty argv publishes readiness;
 * `--help` and extra tokens leave the ACP row pending.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context, FiberState } from '@deepseek-ai/cordis'
import { internals, provideCmdline } from '@deepseek-ai/dsh-cmdline'
import * as AcpStartup from '../src/startup.ts'

const disposers: (() => Promise<void>)[] = []

afterEach(async () => {
  for (const dispose of disposers.splice(0)) await dispose()
  internals.stdout = process.stdout
  internals.stderr = process.stderr
})

/**
 * Parse one ACP invocation against a fresh context.
 * @param args - inner argv after `dsh --profile acp`.
 */
async function boot(args: string[]): Promise<{
  ready: unknown
  exits: number[]
  out: string
  ctx: Context
}> {
  const observed = { exits: [] as number[], out: '' }
  const sink = { write: (chunk: string) => { observed.out += chunk; return true } }
  internals.stdout = sink
  internals.stderr = sink
  const ctx = new Context()
  provideCmdline(ctx, { args, exit: code => void observed.exits.push(code) })
  await ctx.plugin(AcpStartup)
  disposers.push(async () => { await ctx.fiber.dispose() })
  return {
    ready: ctx.get(AcpStartup.ACP_STARTUP_SERVICE),
    exits: observed.exits,
    out: observed.out,
    ctx,
  }
}

describe('acp command-line provider', () => {
  it('publishes readiness on an empty argv', async () => {
    const { ready, exits, out } = await boot([])
    expect(ready).toEqual({ ready: true })
    expect(exits).toEqual([])
    expect(out).toBe('')
  })

  it.each(['--help', '-h'] as const)(
    'prints its own help on %s and does not publish readiness',
    async (flag) => {
      const { ready, exits, out } = await boot([flag])
      expect(out).toContain('Usage: dsh --profile acp')
      expect(out).toContain('serve ACP on stdin/stdout')
      expect(ready).toBeUndefined()
      expect(exits).toEqual([0])
    },
  )

  it('rejects extra arguments before the ACP row can bind stdio', async () => {
    const { ready, exits, out } = await boot(['unexpected'])
    expect(out).toMatch(/unknown command|too many arguments|excess/i)
    expect(ready).toBeUndefined()
    expect(exits).toEqual([1])
  })

  it('rejects unknown options before the ACP row can bind stdio', async () => {
    const { ready, exits, out } = await boot(['--bogus'])
    expect(out).toMatch(/unknown option/i)
    expect(ready).toBeUndefined()
    expect(exits).toEqual([1])
  })

  it('holds an acpStartup consumer until a successful parse', async () => {
    let started = false
    const { ctx, ready, exits } = await boot(['--help'])
    const consumer = Object.assign(function acpApply() { started = true }, {
      inject: [AcpStartup.ACP_STARTUP_SERVICE],
    })
    const fiber = ctx.plugin(consumer)
    expect(ready).toBeUndefined()
    expect(exits).toEqual([0])
    expect(started).toBe(false)
    expect(fiber.state).toBe(FiberState.PENDING)
  })

  it('starts an acpStartup consumer after a successful parse', async () => {
    let started = false
    const { ctx, ready } = await boot([])
    const consumer = Object.assign(function acpApply() { started = true }, {
      inject: [AcpStartup.ACP_STARTUP_SERVICE],
    })
    await ctx.plugin(consumer)
    expect(ready).toEqual({ ready: true })
    expect(started).toBe(true)
  })
})
