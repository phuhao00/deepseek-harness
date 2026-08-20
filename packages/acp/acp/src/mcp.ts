/**
 * Mount stdio MCP servers from an ACP `session/new` onto one agent scope.
 *
 * Buzz (and other ACP clients) pass `mcpServers` on every session so the
 * agent can call client-owned tools such as the Buzz CLI. HTTP, SSE, and ACP
 * transports are rejected: this bridge only spawns stdio children.
 * @module
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  RequestError,
  type McpServer,
  type McpServerStdio,
} from '@agentclientprotocol/sdk'
import * as McpClient from '@deepseek-ai/dsh-mcp-client'
import { errorChain } from '@deepseek-ai/dsh-llm'

/** mcp-client `serverName` budget: `[A-Za-z0-9_-]{1,32}`. */
const SERVER_NAME_MAX = 32
const SERVER_NAME_INVALID = /[^A-Za-z0-9_-]/g

/** Preserve invalid-parameter detail in the SDK wire error message. */
function invalidParams(detail: string): RequestError {
  return RequestError.invalidParams(undefined, detail)
}

/** Preserve failed-mount detail as a wire internal error. */
function internalError(detail: string): RequestError {
  return RequestError.internalError(undefined, detail)
}

/**
 * Fold ACP `{name,value}[]` env into the record mcp-client merges onto the
 * scrubbed parent environment.
 * @param env - ACP env array; later duplicates win.
 * @returns name-to-value map for mcp-client.
 */
export function mcpEnvRecord(env: McpServerStdio['env']): Record<string, string> {
  const out: Record<string, string> = {}
  for (const item of env) out[item.name] = item.value
  return out
}

/**
 * Turn an ACP MCP `name` into a unique mcp-client `serverName`.
 * @param raw - client-supplied human-readable name (Buzz uses the CLI stem).
 * @param used - names already allocated in this session.
 * @returns sanitized unique server name, also recorded in `used`.
 */
export function allocateMcpServerName(raw: string, used: Set<string>): string {
  let base = raw.replace(SERVER_NAME_INVALID, '_')
  if (base.length === 0) base = 'mcp'
  if (base.length > SERVER_NAME_MAX) base = base.slice(0, SERVER_NAME_MAX)
  let candidate = base
  let n = 2
  while (used.has(candidate)) {
    const suffix = `_${n}`
    candidate = `${base.slice(0, SERVER_NAME_MAX - suffix.length)}${suffix}`
    n += 1
  }
  used.add(candidate)
  return candidate
}

/** Stdio MCP has no `type` discriminant; http/sse/acp always carry one. */
function isStdioMcpServer(server: McpServer): server is McpServerStdio {
  return !('type' in server)
}

/**
 * Plugin one stdio mcp-client instance per `session/new` server onto the
 * unpublished agent scope. Tools register as `mcp__<serverName>__<rawName>`
 * and unwind with the agent.
 * @param agentCtx - unpublished agent scope from `agents.create` setup.
 * @param servers - ACP `mcpServers` list, possibly empty.
 * @param cwd - absolute session workspace, used as the child cwd.
 */
export async function mountSessionMcpServers(
  agentCtx: Context,
  servers: readonly McpServer[],
  cwd: string,
): Promise<void> {
  const used = new Set<string>()
  for (const server of servers) {
    if (!isStdioMcpServer(server)) {
      throw invalidParams(`mcpServers transport ${server.type} is not supported`)
    }
    const serverName = allocateMcpServerName(server.name, used)
    try {
      await agentCtx.plugin(McpClient, {
        transport: 'stdio',
        serverName,
        command: server.command,
        args: server.args,
        env: mcpEnvRecord(server.env),
        cwd,
        toolCallTimeoutMs: 60_000,
        failOnStartupError: true,
        reconnect: { enabled: false },
      })
    } catch (error: unknown) {
      throw internalError(`mcpServers ${serverName}: ${errorChain(error)}`)
    }
  }
}
