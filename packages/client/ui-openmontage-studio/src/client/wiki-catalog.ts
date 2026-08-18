/**
 * Discover OpenWiki pages under a Workspace by listing directories.
 * `host.listDirectory` returns directories only, so each child of `openwiki/`
 * is a selectable page (title = directory name). Markdown files are not listed;
 * the studio paste field covers those.
 * @module @deepseek-ai/dsh-client-ui-openmontage-studio/wiki-catalog
 */

/** One listed OpenWiki page (directory under the workspace `openwiki/` tree). */
export interface WikiPage {
  /** Relative path from `openwiki/` (`capabilities/seams`). */
  slug: string
  /** Last path segment, used as the brief heading. */
  title: string
  /** Absolute host path of the directory. */
  path: string
}

/** Directory listing the wiki walk consumes (subset of `DirectoryListing`). */
export interface WikiDirectoryListing {
  /** Absolute path of the listed directory. */
  path: string
  /** Direct child directories. */
  entries: readonly { name: string; path: string }[]
}

/** List one directory level; missing or unreadable targets should reject. */
export type ListDirectory = (path: string, signal?: AbortSignal) => Promise<WikiDirectoryListing>

const WIKI_DIR_NAMES = new Set(['openwiki', 'OpenWiki'])

/**
 * Recursively list OpenWiki directory pages under a Workspace root.
 * Looks up a child named `openwiki` / `OpenWiki` instead of joining paths.
 * @param listDirectory - existing `host.listDirectory` wrapper.
 * @param workspacePath - absolute Workspace directory.
 * @param signal - aborts a superseded walk.
 * @returns pages in depth-first, name-sorted order; empty when `openwiki/` is absent.
 */
export async function listWorkspaceWikiPages(
  listDirectory: ListDirectory,
  workspacePath: string,
  signal?: AbortSignal,
): Promise<WikiPage[]> {
  let root: WikiDirectoryListing
  try {
    root = await listDirectory(workspacePath, signal)
  } catch {
    return []
  }
  const wiki = root.entries.find(entry => WIKI_DIR_NAMES.has(entry.name))
  if (wiki === undefined) return []
  return collectPages(listDirectory, wiki.path, '', signal)
}

/**
 * Walk one OpenWiki directory and its descendants.
 * @param listDirectory - listing function.
 * @param absPath - absolute directory to list.
 * @param slugPrefix - relative slug of this directory under `openwiki/`.
 * @param signal - abort signal.
 * @returns pages at this level and below.
 */
async function collectPages(
  listDirectory: ListDirectory,
  absPath: string,
  slugPrefix: string,
  signal?: AbortSignal,
): Promise<WikiPage[]> {
  signal?.throwIfAborted()
  let listing: WikiDirectoryListing
  try {
    listing = await listDirectory(absPath, signal)
  } catch {
    return []
  }
  const pages: WikiPage[] = []
  const entries = listing.entries.slice().sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    const slug = slugPrefix === '' ? entry.name : `${slugPrefix}/${entry.name}`
    pages.push({ slug, title: entry.name, path: entry.path })
    pages.push(...await collectPages(listDirectory, entry.path, slug, signal))
  }
  return pages
}
