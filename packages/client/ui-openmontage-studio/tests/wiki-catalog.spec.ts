import { describe, expect, it, vi } from 'vitest'
import { listWorkspaceWikiPages, type ListDirectory } from '../src/client/wiki-catalog.ts'

function tree(map: Record<string, readonly { name: string; path: string }[]>): ListDirectory {
  return async (path) => {
    const entries = map[path]
    if (entries === undefined) throw new Error(`missing ${path}`)
    return { path, entries }
  }
}

describe('listWorkspaceWikiPages', () => {
  it('walks openwiki/ directory names in sorted depth-first order', async () => {
    const pages = await listWorkspaceWikiPages(tree({
      '/ws': [{ name: 'src', path: '/ws/src' }, { name: 'openwiki', path: '/ws/openwiki' }],
      '/ws/openwiki': [
        { name: 'beta', path: '/ws/openwiki/beta' },
        { name: 'alpha', path: '/ws/openwiki/alpha' },
      ],
      '/ws/openwiki/alpha': [{ name: 'child', path: '/ws/openwiki/alpha/child' }],
      '/ws/openwiki/beta': [],
      '/ws/openwiki/alpha/child': [],
    }), '/ws')
    expect(pages.map(page => page.slug)).toEqual(['alpha', 'alpha/child', 'beta'])
    expect(pages[0]).toEqual({ slug: 'alpha', title: 'alpha', path: '/ws/openwiki/alpha' })
  })

  it('accepts OpenWiki as the catalog root', async () => {
    const pages = await listWorkspaceWikiPages(tree({
      '/ws': [{ name: 'OpenWiki', path: '/ws/OpenWiki' }],
      '/ws/OpenWiki': [{ name: 'intro', path: '/ws/OpenWiki/intro' }],
      '/ws/OpenWiki/intro': [],
    }), '/ws')
    expect(pages).toEqual([{ slug: 'intro', title: 'intro', path: '/ws/OpenWiki/intro' }])
  })

  it('returns empty when the workspace cannot be listed or has no wiki directory', async () => {
    await expect(listWorkspaceWikiPages(async () => { throw new Error('gone') }, '/ws')).resolves.toEqual([])
    await expect(listWorkspaceWikiPages(tree({ '/ws': [{ name: 'src', path: '/ws/src' }] }), '/ws')).resolves.toEqual([])
  })

  it('skips a wiki subtree that cannot be listed', async () => {
    const pages = await listWorkspaceWikiPages(tree({
      '/ws': [{ name: 'openwiki', path: '/ws/openwiki' }],
    }), '/ws')
    expect(pages).toEqual([])
  })

  it('rejects when the walk is aborted after the workspace listing', async () => {
    const controller = new AbortController()
    controller.abort()
    const list = vi.fn(async (path: string) => ({
      path,
      entries: path === '/ws' ? [{ name: 'openwiki', path: '/ws/openwiki' }] : [],
    }))
    await expect(listWorkspaceWikiPages(list, '/ws', controller.signal)).rejects.toThrow()
  })
})
