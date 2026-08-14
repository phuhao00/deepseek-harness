import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import * as OpenMontage from '@deepseek-ai/dsh-openmontage'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

describe('openmontage real Loader composition through cordis.yml', () => {
  it('boots cordis.yml against a fixture checkout and exposes the prompt and skills', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-openmontage-loader-'))
    const checkout = join(root, 'OpenMontage')
    await mkdir(checkout)
    await writeFile(join(checkout, 'AGENT_GUIDE.md'), 'fixture guide\n')
    await mkdir(join(checkout, 'pipeline_defs'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@deepseek-ai/dsh-skill'",
      "- name: '@deepseek-ai/dsh-system-prompt'",
      "- name: '@deepseek-ai/dsh-openmontage'",
      '  config:',
      `    root: ${JSON.stringify(checkout)}`,
      '',
    ].join('\n'))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@deepseek-ai/dsh-skill', SkillRegistry],
      ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
      ['@deepseek-ai/dsh-openmontage', OpenMontage],
    ])
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await context.loader.await()

    const assembly = await context.systemPrompt.assemble()
    expect(assembly.variables).toMatchObject({ openmontage_root: checkout })
    expect(renderPrompt(assembly)).toContain(
      OpenMontage.OPENMONTAGE_SECTION_TEXT.replaceAll('{{openmontage_root}}', checkout),
    )
    expect((await context.skills.list()).map(skill => skill.name).sort())
      .toEqual(['openmontage', 'openmontage-onboarding'])
  })
})
