/**
 * ACP session MCP name/env helpers used when Buzz (and other clients) pass
 * stdio servers on `session/new`.
 */

import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { McpServer } from '@agentclientprotocol/sdk'
import * as McpClient from '@deepseek-ai/dsh-mcp-client'
import {
  allocateMcpServerName,
  mcpEnvRecord,
  mountSessionMcpServers,
} from '../src/mcp.ts'

function fakeAgentCtx(plugin: ReturnType<typeof vi.fn>): Context {
  return { plugin } as unknown as Context
}

describe('ACP session MCP helpers', () => {
  it('allocates unique server names that fit the mcp-client contract', () => {
    const used = new Set<string>()
    expect(allocateMcpServerName('fixture', used)).toBe('fixture')
    expect(allocateMcpServerName('fixture', used)).toBe('fixture_2')
    expect(allocateMcpServerName('', used)).toBe('mcp')
    expect(allocateMcpServerName('', used)).toBe('mcp_2')
    expect(allocateMcpServerName('!!!', used)).toBe('___')
    expect(allocateMcpServerName('buzz.cli', used)).toBe('buzz_cli')
    const long = 'a'.repeat(40)
    expect(allocateMcpServerName(long, used)).toBe('a'.repeat(32))
    expect(allocateMcpServerName('a'.repeat(32), used)).toBe(`${'a'.repeat(30)}_2`)
  })

  it('folds ACP env arrays into a record, last duplicate winning', () => {
    expect(mcpEnvRecord([])).toEqual({})
    expect(mcpEnvRecord([
      { name: 'BUZZ_RELAY_URL', value: 'ws://relay' },
      { name: 'BUZZ_RELAY_URL', value: 'ws://other' },
    ])).toEqual({ BUZZ_RELAY_URL: 'ws://other' })
  })
})

describe('mountSessionMcpServers', () => {
  it('is a no-op for an empty mcpServers list', async () => {
    const plugin = vi.fn()
    await mountSessionMcpServers(fakeAgentCtx(plugin), [], '/tmp/ws')
    expect(plugin).not.toHaveBeenCalled()
  })

  it.each([
    {
      type: 'http' as const,
      server: { type: 'http' as const, name: 'remote', url: 'http://127.0.0.1:9', headers: [] },
    },
    {
      type: 'sse' as const,
      server: { type: 'sse' as const, name: 'events', url: 'http://127.0.0.1:9', headers: [] },
    },
    {
      type: 'acp' as const,
      server: { type: 'acp' as const, name: 'nested', id: 'nested-1' },
    },
  ])('rejects $type mcpServers before spawning', async ({ type, server }) => {
    const plugin = vi.fn()
    await expect(mountSessionMcpServers(fakeAgentCtx(plugin), [server], '/tmp/ws'))
      .rejects.toThrow(new RegExp(`mcpServers transport ${type} is not supported`))
    expect(plugin).not.toHaveBeenCalled()
  })

  it('plugins each stdio server onto the agent context with Buzz-style env', async () => {
    const plugin = vi.fn().mockResolvedValue(undefined)
    const servers: McpServer[] = [
      {
        name: 'buzz',
        command: 'dsh',
        args: ['mcp'],
        env: [
          { name: 'BUZZ_RELAY_URL', value: 'ws://relay' },
          { name: 'BUZZ_PRIVATE_KEY', value: 'k' },
        ],
      },
      {
        name: 'buzz',
        command: 'dsh',
        args: [],
        env: [],
      },
    ]
    await mountSessionMcpServers(fakeAgentCtx(plugin), servers, '/abs/cwd')
    expect(plugin).toHaveBeenCalledTimes(2)
    expect(plugin).toHaveBeenNthCalledWith(1, McpClient, {
      transport: 'stdio',
      serverName: 'buzz',
      command: 'dsh',
      args: ['mcp'],
      env: { BUZZ_RELAY_URL: 'ws://relay', BUZZ_PRIVATE_KEY: 'k' },
      cwd: '/abs/cwd',
      toolCallTimeoutMs: 60_000,
      failOnStartupError: true,
      reconnect: { enabled: false },
    })
    expect(plugin.mock.calls[1]?.[1]).toMatchObject({ serverName: 'buzz_2', args: [] })
  })

  it('wraps a failed plugin mount as an internal mcpServers error', async () => {
    const plugin = vi.fn().mockRejectedValue(new Error('spawn failed'))
    await expect(mountSessionMcpServers(fakeAgentCtx(plugin), [{
      name: 'dead',
      command: 'missing',
      args: [],
      env: [],
    }], '/tmp/ws')).rejects.toThrow(/mcpServers dead/)
  })
})
