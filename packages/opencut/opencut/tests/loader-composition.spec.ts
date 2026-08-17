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
import * as OpenCut from '@deepseek-ai/dsh-opencut'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

describe('opencut real Loader composition through cordis.yml', () => {
  it('boots both adapters against fixture checkouts and exposes the handoff skill', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-opencut-loader-'))
    const cut = join(root, 'OpenCut')
    const montage = join(root, 'OpenMontage')
    await mkdir(join(cut, 'apps', 'web'), { recursive: true })
    await writeFile(join(cut, 'moon.yml'), 'fixture: true\n')
    await mkdir(montage)
    await writeFile(join(montage, 'AGENT_GUIDE.md'), 'fixture guide\n')
    await mkdir(join(montage, 'pipeline_defs'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@deepseek-ai/dsh-skill'",
      "- name: '@deepseek-ai/dsh-system-prompt'",
      "- name: '@deepseek-ai/dsh-openmontage'",
      '  config:',
      `    root: ${JSON.stringify(montage)}`,
      "- name: '@deepseek-ai/dsh-opencut'",
      '  config:',
      `    root: ${JSON.stringify(cut)}`,
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
      ['@deepseek-ai/dsh-opencut', OpenCut],
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
    expect(assembly.variables).toMatchObject({
      opencut_root: cut,
      openmontage_root: montage,
    })
    expect(renderPrompt(assembly)).toContain(
      OpenCut.OPENCUT_SECTION_TEXT.replaceAll('{{opencut_root}}', cut),
    )
    expect((await context.skills.list()).map(skill => skill.name).sort())
      .toEqual(['opencut', 'opencut-openmontage', 'openmontage', 'openmontage-onboarding'])
    const handoff = await context.skills.get('opencut-openmontage')
    expect(handoff?.content).toContain(`OpenMontage checkout: \`${montage}\``)
  })
})
