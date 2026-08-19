/**
 * The ACP app's command-line provider: it parses `--help` and rejects extra
 * arguments, then publishes {@link ACP_STARTUP_SERVICE}. The ACP transport
 * row injects that service so help and usage errors never bind stdio.
 * @module @deepseek-ai/dsh-acp-app/startup
 */

import { Command } from 'commander'
import type { Context } from '@deepseek-ai/cordis'
import { parseCmdline } from '@deepseek-ai/dsh-cmdline'

/** Stable Cordis plugin name. */
export const name = 'acp-startup'

/** Services required before the invocation can be accepted. */
export const inject = ['cmdlineArgs']

/** Service provided by this plugin and injected by the ACP transport row. */
export const ACP_STARTUP_SERVICE = 'acpStartup'

/** What the ACP row waits for from {@link ACP_STARTUP_SERVICE}. */
export interface AcpStartupValues {
  /** True after a successful parse with no extra arguments. */
  ready: true
}

/**
 * This app's command: no task positional, its description, and its help text.
 * Extra tokens are a usage error so they cannot leak onto the ACP wire.
 * @returns a fresh program, so one process can parse more than once (tests).
 */
function acpCommand(): Command {
  return new Command()
    .name('dsh --profile acp')
    .description('Serve Agent Client Protocol on stdio and keep stdout protocol-pure.')
    .helpOption('-h, --help', 'show this help')
    .allowExcessArguments(false)
    .addHelpText('after', `
Examples:
  dsh --profile acp                          serve ACP on stdin/stdout
`)
}

/**
 * Parse this invocation and provide the ACP gate as an ordinary Cordis
 * service. The command's action publishes readiness; on `--help` and on a
 * rejected parse nothing is provided, so the ACP row stays pending.
 * @param ctx - plugin context carrying the command line.
 */
export function apply(ctx: Context): void {
  const program = acpCommand()
  program.action(() => {
    ctx.provide(ACP_STARTUP_SERVICE, { ready: true } satisfies AcpStartupValues)
  })
  parseCmdline(ctx, program)
}
