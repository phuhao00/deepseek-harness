import { describe, expect, it } from 'vitest'
import {
  formatStudioPrompt,
  isStudioGenerationProfile,
  isStudioResolution,
  isStudioUpscaleTarget,
  isValidStudioUpscale,
  readStudioSettings,
  upscaleTargetsFor,
} from '../src/client/studio-prompt.ts'

describe('formatStudioPrompt', () => {
  it('pins the model-visible first user message', async () => {
    await expect(formatStudioPrompt({
      durationSeconds: 30,
      resolution: '1080p',
      generationProfile: 'cost',
      workspacePath: '/projects/film',
      outputPath: '/projects/film',
      brief: '  海边日落宣传片  ',
      wikiPages: [{ title: 'pipeline', summary: 'OpenMontage 管线阶段。' }],
      pastedExcerpt: '角色：向导。',
    })).toMatchFileSnapshot('./snapshots/studio-brief.expected.txt')
  })

  it('omits the OpenWiki block when nothing was selected or pasted', () => {
    expect(formatStudioPrompt({
      durationSeconds: 15,
      resolution: '720p',
      generationProfile: 'auto',
      workspacePath: '/ws',
      outputPath: '/out',
      brief: '短片',
      wikiPages: [],
    })).toBe([
      '制作一条视频。',
      '先 load `openmontage` skill，再按 pipeline 执行；用户给出的时长、清晰度、超分目标、输出目录与生成方案必须遵守，不得自行改规格。',
      '时长：15 秒。清晰度：720p。',
      '生成方案：自动。',
      '工作区目录：/ws。',
      '输出目录：/out。',
      '简报：',
      '短片',
      '',
    ].join('\n'))
  })

  it('names an upscale target after the generation resolution', () => {
    expect(formatStudioPrompt({
      durationSeconds: 30,
      resolution: '480p',
      upscaleTo: '4k',
      generationProfile: 'quality',
      workspacePath: '/ws',
      outputPath: '/ws',
      brief: '片',
      wikiPages: [],
    })).toContain('时长：30 秒。清晰度：480p。超分到：4k。')
  })

  it('prints a wiki heading without a summary and skips a blank paste', () => {
    expect(formatStudioPrompt({
      durationSeconds: 60,
      resolution: '4k',
      generationProfile: 'drama',
      workspacePath: '/ws',
      outputPath: '/ws',
      brief: '片',
      wikiPages: [{ title: 'alpha' }, { title: 'beta', summary: '  ' }],
      pastedExcerpt: '   ',
    })).toContain('## alpha\n## beta\n')
  })
})

describe('readStudioSettings', () => {
  it('reads finite positive duration, resolution, upscale, and profile', () => {
    expect(readStudioSettings({
      outputDurationSeconds: 45,
      outputResolution: '480p',
      outputUpscaleTo: '1080p',
      generationProfile: 'cost',
    }, 3)).toEqual({
      durationSeconds: 45,
      resolution: '480p',
      upscaleTo: '1080p',
      generationProfile: 'cost',
      revision: 3,
    })
  })

  it('omits invalid fields and non-objects', () => {
    expect(readStudioSettings(null, 1)).toEqual({
      durationSeconds: undefined,
      resolution: undefined,
      upscaleTo: undefined,
      generationProfile: undefined,
      revision: 1,
    })
    expect(readStudioSettings({
      outputDurationSeconds: 0,
      outputResolution: '8k',
      outputUpscaleTo: '720p',
      generationProfile: 'bogus',
    }, 2)).toEqual({
      durationSeconds: undefined,
      resolution: undefined,
      upscaleTo: undefined,
      generationProfile: undefined,
      revision: 2,
    })
    expect(readStudioSettings({
      outputDurationSeconds: 30,
      outputResolution: '1080p',
      outputUpscaleTo: '720p',
    }, 4)).toEqual({
      durationSeconds: 30,
      resolution: '1080p',
      upscaleTo: undefined,
      generationProfile: undefined,
      revision: 4,
    })
    expect(isStudioResolution('480p')).toBe(true)
    expect(isStudioResolution('8k')).toBe(false)
    expect(isStudioUpscaleTarget('720p')).toBe(true)
    expect(isStudioGenerationProfile('drama')).toBe(true)
    expect(isStudioGenerationProfile('seedance')).toBe(false)
    expect(isValidStudioUpscale('480p', '720p')).toBe(true)
    expect(isValidStudioUpscale('4k', '1080p')).toBe(false)
    expect(upscaleTargetsFor('720p')).toEqual(['1080p', '4k'])
  })
})
