// Writes the catalog into the export after `vite build`: a page per listing (the
// built shell with that page's head and static body), its Markdown twin, the
// shelves and the front, sitemap.xml, llms.txt, llms-full.txt, 404.html, and a
// moved page for every path the last release listed and this one does not
// (retired.json carries them on). Every source is read whole from the platform;
// one that does not answer, or answers empty, stops the build, so a publish
// never drops pages it could not read.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { GATEWAY } from '~/lib/api'
import { KINDS, type AppEntry, type ShopListing, type SkillIndex } from '~/lib/market'
import {
  appPage,
  directoryPage,
  file,
  front,
  hidden,
  html,
  llms,
  llmsFull,
  locs,
  markdown,
  missing,
  moved,
  movedMarkdown,
  outside,
  personaPage,
  PRIVATE,
  prune,
  retire,
  serverPage,
  shelf,
  shopPage,
  SITE,
  sitemaps,
  skillPage,
  templatePage,
  twin,
  writable,
  type Page,
  type Retired,
} from '~/lib/pages'
import { PERSONAS } from '~/lib/personas'
import { DEFAULT_LISTINGS, DEFAULT_MCP_CATALOG } from '~/lib/registry'
import { TEMPLATES } from '~/lib/templates'

const ROOT = join(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
const UA = 'Mozilla/5.0 (compatible; HanzoMarketBuild/1.0; +https://hanzo.market)'
/** The page of the platform's lists: the most one read returns. */
const PAGE = 200
/** URLs the build makes itself, or reads from the repository the data comes from: not fetched to be checked. */
const KNOWN = [
  `${GATEWAY}/v1/marketplace/shop/`,
  `${GATEWAY}/v1/catalog?`,
  `${GATEWAY}/.well-known/agent-skills/`,
  'https://github.com/hanzoai/personas/tree/main/personas/',
]

const started = Date.now()
const say = (s: string) => console.log(`pages: ${s}`)

/** A read that answers, or 404; a server error or a dropped connection is asked twice more, anything else stops the build. */
async function get(url: string, accept: string): Promise<Response> {
  let failed = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, (attempt - 1) * 2000))
    const r = await fetch(url, { headers: { Accept: accept, 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) }).catch((e: unknown) =>
      e instanceof Error ? e : new Error(String(e)),
    )
    if (r instanceof Error) {
      failed = r.message
      continue
    }
    if (r.ok || r.status === 404) return r
    failed = `HTTP ${r.status}`
    if (r.status < 500 && r.status !== 429) break
  }
  throw new Error(`${url}: ${failed}`)
}

async function json<T>(url: string): Promise<T> {
  const r = await get(url, 'application/json')
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
  return (await r.json()) as T
}

/** Every row of a paged list, read until its total. */
async function whole<T>(path: string, key: string): Promise<T[]> {
  const out: T[] = []
  for (let total = 1; out.length < total; ) {
    const page = await json<Record<string, unknown>>(`${GATEWAY}${path}?limit=${PAGE}&offset=${out.length}`)
    const rows = page[key] as T[]
    total = Number(page.total)
    if (!rows.length && out.length < total) throw new Error(`${GATEWAY}${path} stopped at ${out.length} of ${total} ${key}`)
    out.push(...rows)
  }
  if (!out.length) throw new Error(`${GATEWAY}${path} answered no ${key}: refusing to publish an empty shelf`)
  return out
}

/** What the live release listed: its sitemap's pages and the paths it carries as retired. A first release has neither. */
async function previous(): Promise<{ listed: string[]; retired: Retired[] }> {
  const read = async (url: string): Promise<string | null> => {
    const r = await get(url, '*/*')
    return r.status === 404 ? null : r.text()
  }
  const index = await read(`${SITE}/sitemap.xml`)
  let urls = index ? locs(index) : []
  if (index?.includes('<sitemapindex')) urls = (await Promise.all(urls.map(read))).flatMap((x) => (x ? locs(x) : []))
  const listed = urls.map((u) => new URL(u).pathname.replace(/\/+$/, '') || '/')
  const carried = await read(`${SITE}/retired.json`)
  const retired = carried ? (JSON.parse(carried) as Retired[]).filter((r) => typeof r.path === 'string' && typeof r.to === 'string' && typeof r.since === 'string') : []
  return { listed, retired }
}

/** The https URLs that answered 2xx, after redirects. A refusal, a timeout or a second server error drops the link. */
async function alive(urls: string[]): Promise<Set<string>> {
  const ok = new Set<string>()
  const queue = [...new Set(urls)].filter((u) => u.startsWith('https://'))
  const answers = async (url: string) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, signal: AbortSignal.timeout(10_000) }).catch(() => null)
      if (!r) return false
      await r.body?.cancel()
      if (r.ok) return true
      if (r.status < 500 && r.status !== 429) return false
    }
    return false
  }
  await Promise.all(
    Array.from({ length: 24 }, async () => {
      for (let url = queue.pop(); url; url = queue.pop()) if (await answers(url)) ok.add(url)
    }),
  )
  return ok
}

async function put(rel: string, body: string) {
  const at = join(DIST, rel)
  await mkdir(dirname(at), { recursive: true })
  await writeFile(at, body)
}

const shell = await readFile(join(DIST, 'index.html'), 'utf8')
const [sold, built, index, registry, before] = await Promise.all([
  whole<ShopListing>('/v1/marketplace/shop', 'listings'),
  whole<AppEntry>('/v1/catalog', 'data'),
  json<SkillIndex>(`${GATEWAY}/.well-known/agent-skills/index.json`),
  json<{ total: number }>(`${GATEWAY}/v1/tool/catalog?limit=1`).then((r) => r.total),
  previous(),
])
if (!index.skills.length) throw new Error('the skills index lists no skill: refusing to publish an empty shelf')

// The storefront's own directory, less what the shop sells: the same rule mergeShop shows it by.
const ids = new Set(sold.map((l) => l.id))
const tools = new Set(sold.map((l) => `${l.kind}:${l.tool.toLowerCase()}`))
const directory = DEFAULT_LISTINGS.filter((d) => !ids.has(d.id) && !tools.has(`${d.kind}:${d.tool.toLowerCase()}`))

const defined = new Map(
  await Promise.all(
    PERSONAS.map(async (p) => [p.slug, await readFile(join(ROOT, 'public', 'personas', p.slug, 'PERSONA.md'), 'utf8').catch(() => '')] as const),
  ),
)

const drafted: Page[] = [
  ...sold.map(shopPage),
  ...directory.map(directoryPage),
  ...PERSONAS.map((p) => personaPage(p, defined.get(p.slug) ?? '')),
  ...built.map(appPage),
  ...index.skills.map((s) => skillPage(s, index.base_url ?? GATEWAY)),
  ...DEFAULT_MCP_CATALOG.map(serverPage),
  ...TEMPLATES.map(templatePage),
]

const seen = new Set<string>()
const kept: Page[] = []
for (const p of drafted) {
  if (!writable(p.path)) say(`skipped ${p.path}: not a path the export can hold as written`)
  else if (seen.has(p.path)) say(`skipped ${p.path}: a second listing at one address`)
  else {
    seen.add(p.path)
    kept.push(p)
  }
}

const checked = [...new Set(kept.flatMap(outside))].filter((u) => !KNOWN.some((k) => u.startsWith(k)))
const ok = await alive(checked)
const live = (u: string) => KNOWN.some((k) => u.startsWith(k)) || ok.has(u)
const listings = kept.map((p) => prune(p, live))
say(`links: ${checked.length} checked, ${checked.length - ok.size} dropped (no answer)`)

const note = {
  title: 'The MCP registry',
  lines: [
    `${registry.toLocaleString('en-US')} servers mirrored from registry.modelcontextprotocol.io are searched, not listed here: \`GET ${GATEWAY}/v1/tool/catalog?q=<words>\`, one at \`GET ${GATEWAY}/v1/tool/catalog/{id}\`. The app's MCP servers shelf shows them.`,
  ],
}
const shelves = KINDS.map((k) => shelf(k, listings.filter((p) => p.kind === k), k === 'mcp' ? [note] : []))
const home = front(shelves)
const pages = [home, ...shelves, ...listings, ...PRIVATE.map(hidden)]

const retired = retire(before.listed, before.retired, new Set(pages.map((p) => p.path)), new Date().toISOString().slice(0, 10))

const writes: [string, string][] = [
  ...pages.flatMap((p): [string, string][] => [
    [file(p.path), html(shell, p)],
    [twin(p.path).slice(1), markdown(p)],
  ]),
  ...retired.flatMap((r): [string, string][] => [
    [file(r.path), moved(r)],
    [twin(r.path).slice(1), movedMarkdown(r)],
  ]),
  ['404.html', missing(shell)],
  ...Object.entries(sitemaps(pages)),
  ['llms.txt', llms(home, registry)],
  ['llms-full.txt', llmsFull(pages)],
  ['retired.json', `${JSON.stringify(retired, null, 1)}\n`],
]
for (let i = 0; i < writes.length; i += 256) await Promise.all(writes.slice(i, i + 256).map(([rel, body]) => put(rel, body)))

const by = Object.fromEntries(KINDS.map((k) => [k, listings.filter((p) => p.kind === k).length]))
say(`${pages.length} pages (${listings.length} listings: ${JSON.stringify(by)}), ${retired.length} retired, ${writes.length} files, ${((Date.now() - started) / 1000).toFixed(1)}s`)
