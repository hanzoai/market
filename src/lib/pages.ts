// The catalog as documents a crawler or an agent reads without running the app.
// A page is one listing, one type's shelf, or the front. Its HTML is the built
// shell with the page's own head and a static body the app replaces when it
// mounts; its Markdown twin is the same page as text (/ -> /index.md, /a/b ->
// /a/b.md). Pure: scripts/pages.ts reads the sources, checks the links and
// writes what these return.

import { GATEWAY, web } from '~/lib/api'
import { fromApp, fromListing, fromMcp, fromPersona, fromSkill, fromTemplate, LABEL, PATH, type Item } from '~/lib/catalog'
import { docs, listingDetail, mcpCall } from '~/lib/detail'
import { KINDS, type AppEntry, type Kind, type McpListing, type ShopListing, type SkillEntry } from '~/lib/market'
import type { PersonaEntry } from '~/lib/personas'
import type { TemplateEntry } from '~/lib/templates'

export const SITE = 'https://hanzo.market'
export const NAME = 'Hanzo Market'
export const ABOUT = 'Agents, apps, skills and MCP servers — install them, hire them, or sell your own.'

export interface Link {
  label: string
  href: string
}

export interface Page {
  /** "/" or "/a/b": no trailing slash, as the app routes it. */
  path: string
  title: string
  /** A listing's type; none on a shelf, the front or an app page. */
  kind?: Kind
  /** One line: the meta description and the llms.txt entry. */
  summary: string
  /** What the page states about the thing, in order. */
  facts: [string, string][]
  /** The command that gets it, and the same as a hanzo-mcp call. */
  get: { cli: string | null; mcp: string | null }
  links: Link[]
  /** A document the page carries whole: a persona's definition. */
  doc?: { title: string; text: string }
  /** Sections of plain lines (with `code` and URLs) ahead of a shelf's listings. */
  notes?: { title: string; lines: string[] }[]
  /** A shelf's listings. */
  items?: Page[]
  /** schema.org JSON-LD. */
  ld: Record<string, unknown> | null
  /** ISO date the content last changed, when a source says. */
  modified?: string
  /** Kept out of search and the sitemap: sign-in, a buyer's jobs, a seller's desk. */
  hidden?: boolean
}

const day = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10)
const none = { cli: null, mcp: null }
const OFF_SHOP: [string, string] = ['Shop', 'Not a shop listing']

/** The twin of a page: / is /index.md, /a/b is /a/b.md. */
export const twin = (path: string) => (path === '/' ? '/index.md' : `${path}.md`)

/** Where a page's HTML is written in the export: the plane answers /a/b and /a/b/ from a/b/index.html. */
export const file = (path: string) => (path === '/' ? 'index.html' : `${path.slice(1)}/index.html`)

/** A path the export can hold as written: no encoding, no dot segments. */
export const writable = (path: string) =>
  /^\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*)?$/.test(path) && !/\.(?:md|html?)$/.test(path)

function software(item: Item, category: string | undefined, more: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: item.title,
    ...(item.summary ? { description: item.summary } : {}),
    ...(category ? { applicationCategory: category } : {}),
    url: SITE + item.href,
    publisher: { '@type': 'Organization', name: item.by },
    ...more,
  }
}

const fact = (k: string, v: string | undefined): [string, string][] => (v ? [[k, v]] : [])

/** A seller's listing, as GET /v1/marketplace/shop answers it: the one source with a price. */
export function shopPage(l: ShopListing): Page {
  const item = fromListing(l)
  const doc = docs(l.links.docs ?? l.docs)
  return {
    path: item.href,
    title: item.title,
    kind: item.kind,
    summary: item.summary,
    facts: [['Type', LABEL[l.kind].one], ['Publisher', item.by], ...fact('Category', l.category), ['Price', item.price ?? 'Free'], ['Listed', day(l.createdAt)]],
    get: { cli: l.links.cli, mcp: mcpCall(listingDetail(l)) },
    links: [
      ...(doc ? [{ label: 'Documentation', href: doc }] : []),
      { label: 'This listing as JSON (no key)', href: `${GATEWAY}/v1/marketplace/shop/${encodeURIComponent(l.id)}` },
    ],
    ld: software(item, l.category, { offers: { '@type': 'Offer', price: l.price, priceCurrency: l.currency, url: SITE + item.href } }),
    modified: day(l.updatedAt),
  }
}

/** An entry of the storefront's own directory (src/lib/registry.ts) that the shop does not list: nothing to buy, no price. */
export function directoryPage(l: ShopListing): Page {
  const item = fromListing(l)
  const doc = docs(l.links.docs ?? l.docs)
  return {
    path: item.href,
    title: item.title,
    kind: item.kind,
    summary: item.summary,
    facts: [['Type', LABEL[l.kind].one], ['Publisher', item.by], ...fact('Category', l.category), OFF_SHOP],
    get: none,
    links: doc ? [{ label: 'Source', href: doc }] : [],
    ld: software(item, l.category),
  }
}

/** An MCP server of the storefront's own directory: the registry does not hold it. */
export function serverPage(m: McpListing): Page {
  const item = fromMcp(m)
  const links: Link[] = []
  const site = web(m.site)
  const repo = web(m.repo)
  if (site) links.push({ label: 'Website', href: site })
  if (repo && repo !== site) links.push({ label: 'Source', href: repo })
  return {
    path: item.href,
    title: item.title,
    kind: item.kind,
    summary: item.summary,
    facts: [['Type', LABEL.mcp.one], ['Publisher', item.by], OFF_SHOP],
    get: none,
    links,
    ld: software(item, LABEL.mcp.one),
  }
}

/** A project, app or site the platform built, as GET /v1/catalog answers it. */
export function appPage(e: AppEntry): Page {
  const item = fromApp(e)
  const url = web(e.url)
  const repo = web(e.repo)
  const links: Link[] = []
  if (url) links.push({ label: 'Open', href: url })
  if (repo && repo !== url) links.push({ label: 'Source', href: repo })
  links.push({ label: 'Catalog search for it as JSON (no key)', href: `${GATEWAY}/v1/catalog?org=${encodeURIComponent(e.org)}&q=${encodeURIComponent(e.name)}` })
  const category = e.archetype ?? (e.kind === 'site' ? 'site' : 'repository')
  const modified = e.updated?.slice(0, 10)
  return {
    path: item.href,
    title: item.title,
    kind: item.kind,
    summary: item.summary || `${e.language ? `${e.language} ` : ''}${category} by ${item.by}.`,
    facts: [
      ['Type', LABEL.app.one],
      ['Publisher', item.by],
      ['Category', category],
      ...fact('Language', e.language),
      ...fact('License', e.license),
      ...fact('Upstream', e.upstream),
      ...fact('Updated', modified),
    ],
    get: none,
    links,
    ld: software(item, category, { ...(e.updated ? { dateModified: e.updated } : {}), sameAs: [url, repo].filter((u): u is string => !!u) }),
    modified,
  }
}

/** A skill of the platform's directory (api.hanzo.ai/.well-known/agent-skills): a SKILL.md an agent loads. */
export function skillPage(s: SkillEntry, base: string): Page {
  const item = fromSkill(s)
  const md = `${base}/.well-known/agent-skills/${s.path}`
  return {
    path: item.href,
    title: item.title,
    kind: item.kind,
    summary: item.summary,
    facts: [['Type', LABEL.skill.one], ['Publisher', item.by], ['Category', s.service], ['Price', 'Free to read'], ...fact('SHA-256', s.sha256)],
    get: none,
    links: [{ label: 'SKILL.md', href: md }],
    ld: software(item, s.service, { sameAs: [md] }),
  }
}

/** One of @hanzo/personas' figures, and its PERSONA.md when the storefront carries it. */
export function personaPage(p: PersonaEntry, doc: string): Page {
  const item = fromPersona(p)
  const source = `https://github.com/hanzoai/personas/tree/main/personas/${encodeURIComponent(p.slug)}`
  const category = p.category.replace(/_/g, ' ')
  const text = doc.trim()
  return {
    path: item.href,
    title: item.title,
    kind: item.kind,
    summary: item.summary,
    facts: [['Type', LABEL.persona.one], ['Publisher', item.by], ['Category', category], ...fact('Based on', p.based), ['Price', 'Free, open source']],
    get: none,
    links: [{ label: 'Source', href: source }, ...(text ? [{ label: 'PERSONA.md', href: `${SITE}/personas/${p.slug}/PERSONA.md` }] : [])],
    ...(text ? { doc: { title: 'Definition', text } } : {}),
    ld: software(item, category, { sameAs: [source] }),
  }
}

/** A template of the storefront's own gallery (src/lib/templates.ts). */
export function templatePage(t: TemplateEntry): Page {
  const item = fromTemplate(t)
  const links: Link[] = []
  if (t.preview) links.push({ label: 'Preview', href: t.preview })
  if (t.github) links.push({ label: 'Source', href: t.github })
  return {
    path: item.href,
    title: item.title,
    kind: item.kind,
    summary: item.summary,
    facts: [['Type', LABEL.template.one], ['Publisher', item.by], ['Category', t.category], OFF_SHOP],
    get: none,
    links,
    ld: software(item, t.category),
  }
}

/** Drops every external link the build did not see answer: from the links, and from what JSON-LD says the thing is. */
export function prune(page: Page, live: (url: string) => boolean): Page {
  const ok = (href: string) => href.startsWith(SITE) || live(href)
  const links = page.links.filter((l) => ok(l.href))
  if (!page.ld || !Array.isArray(page.ld.sameAs)) return { ...page, links }
  const { sameAs, ...rest } = page.ld
  const kept = (sameAs as string[]).filter(ok)
  return { ...page, links, ld: kept.length ? { ...rest, sameAs: kept } : rest }
}

/** Every URL a page links outside this site. */
export const outside = (page: Page): string[] => [
  ...page.links.map((l) => l.href),
  ...(page.ld && Array.isArray(page.ld.sameAs) ? (page.ld.sameAs as string[]) : []),
].filter((h) => !h.startsWith(SITE))

const SHELF: Record<Kind, string> = {
  agent: 'Agents to hire for a job, paid at release, and the agents of the storefront’s directory.',
  persona: 'Open-source personas from @hanzo/personas: who a model speaks as, and how it reasons.',
  app: 'Projects, apps and sites built on the Hanzo platform, from GET /v1/catalog.',
  skill: 'Skills from the platform’s directory: one SKILL.md per operation, for an agent to load.',
  mcp: 'MCP servers and connectors.',
  tool: 'Tools sold per call, and the tools of the storefront’s directory.',
  template: 'Templates of the storefront’s gallery.',
}

/** One type's shelf: every page of that type, in the order given. */
export function shelf(kind: Kind, items: Page[], notes: Page['notes'] = []): Page {
  const path = PATH[kind]
  return {
    path,
    title: LABEL[kind].many,
    summary: `${SHELF[kind]} ${items.length} listed.`,
    facts: [],
    get: none,
    links: [],
    notes,
    items,
    ld: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${LABEL[kind].many} — ${NAME}`,
      url: SITE + path,
      isPartOf: { '@type': 'WebSite', name: NAME, url: `${SITE}/` },
    },
  }
}

/** What an agent does here, on the front page and in llms.txt. Every URL answers today. */
export const AGENTS = [
  `Read the catalog with no key: \`GET ${GATEWAY}/v1/marketplace/shop?q=<words>&kind=<type>\` (seller listings), \`GET ${GATEWAY}/v1/catalog?q=<words>\` (apps), \`GET ${GATEWAY}/.well-known/agent-skills/index.json\` (skills), \`GET ${GATEWAY}/v1/tool/catalog?q=<words>\` (MCP servers). The operations: ${GATEWAY}/v1/openapi.json?capability=marketplace`,
  `Install or hire with a credential: how an agent gets one is ${SITE}/auth.md. Then \`POST ${GATEWAY}/v1/marketplace/install\` with \`{"tool":"<name>"}\` (or \`hanzo marketplace install --tool <name>\`) activates a tool for your org; an agent is hired with the command its listing names.`,
  `Every page has a Markdown twin: append .md (/ is /index.md). The whole catalog as one file: ${SITE}/llms-full.txt`,
  'In a browser, the page registers two read-only WebMCP tools: search_market and get_listing.',
]

/** The front page: what the market is, the shelves, and what an agent does here. */
export function front(shelves: Page[]): Page {
  return {
    path: '/',
    title: NAME,
    summary: ABOUT,
    facts: [],
    get: none,
    links: [
      { label: 'Every listing, for agents', href: `${SITE}/llms.txt` },
      { label: 'How an agent authenticates', href: `${SITE}/auth.md` },
      { label: 'API catalog', href: `${SITE}/.well-known/api-catalog` },
      { label: 'Documentation', href: 'https://docs.hanzo.ai/docs/marketplace' },
    ],
    notes: [{ title: 'For agents', lines: AGENTS }],
    items: shelves,
    ld: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: NAME,
      url: `${SITE}/`,
      description: ABOUT,
      publisher: { '@type': 'Organization', name: 'Hanzo', url: 'https://hanzo.ai' },
      potentialAction: { '@type': 'SearchAction', target: `${SITE}/?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
    },
  }
}

/** The app's own pages that need a session or carry a sign-in: a shell, a twin that says so, and no search. */
export const PRIVATE: { path: string; title: string; summary: string }[] = [
  { path: '/login', title: 'Sign in', summary: 'People sign in to Hanzo Market here with Hanzo ID.' },
  { path: '/signup', title: 'Create an account', summary: 'People create a Hanzo account here.' },
  { path: '/auth/callback', title: 'Signing in', summary: 'Where Hanzo ID returns a person after sign-in.' },
  { path: '/jobs', title: 'Jobs', summary: 'A buyer’s jobs: open, accepted, delivered, released or disputed.' },
  { path: '/sell', title: 'Sell', summary: 'An organization sets itself up as a seller: identity, tax form, payout wallet.' },
  { path: '/sell/listings', title: 'Your listings', summary: 'The listings a seller’s organization publishes.' },
  { path: '/sell/listings/new', title: 'New listing', summary: 'A seller publishes a listing.' },
  { path: '/sell/jobs', title: 'Seller jobs', summary: 'The jobs a seller’s organization was hired for.' },
  { path: '/sell/earnings', title: 'Earnings', summary: 'What a seller’s organization was paid, and the 1099s it received.' },
]

export function hidden(p: { path: string; title: string; summary: string }): Page {
  return {
    ...p,
    facts: [],
    get: none,
    links: [{ label: 'How an agent authenticates instead', href: `${SITE}/auth.md` }],
    ld: null,
    hidden: true,
  }
}

// ── Markdown ────────────────────────────────────────────────────────────────

/** One line: newlines and runs of space collapsed. */
const line = (s: string) => s.replace(/\s+/g, ' ').trim()
/** Link text that cannot close the link. */
const label = (s: string) => line(s).replace(/([[\]\\])/g, '\\$1')
/** A destination CommonMark reads whole. */
const dest = (u: string) => (/[\s()<>]/.test(u) ? `<${u.replace(/[<>]/g, encodeURIComponent)}>` : u)
const mdLink = (text: string, href: string) => `[${label(text)}](${dest(href)})`

function entries(items: Page[]): string[] {
  return items.map((p) => `- ${mdLink(p.title, SITE + p.path)}${p.summary ? `: ${line(p.summary)}` : ''}`)
}

/** The page as Markdown: its title, what it says, how to get it, its links. */
export function markdown(p: Page): string {
  const out = [`# ${line(p.title)}`, '']
  if (p.summary) out.push(`> ${line(p.summary)}`, '')
  if (p.facts.length) out.push(...p.facts.map(([k, v]) => `- ${k}: ${line(v)}`), '')
  if (p.get.cli || p.get.mcp) {
    out.push('## Get it', '')
    if (p.get.cli) out.push('```sh', p.get.cli, '```', '')
    if (p.get.mcp) out.push(`As a hanzo-mcp call (\`tools/call\` on ${GATEWAY}/v1/mcp):`, '', '```json', p.get.mcp, '```', '')
    out.push(`Both need a Hanzo credential: ${SITE}/auth.md`, '')
  }
  if (p.links.length) out.push('## Links', '', ...p.links.map((l) => `- ${mdLink(l.label, l.href)}`), '')
  for (const n of p.notes ?? []) out.push(`## ${n.title}`, '', ...n.lines.map((l) => `- ${l}`), '')
  if (p.doc) out.push(`## ${p.doc.title}`, '', '````markdown', p.doc.text, '````', '')
  if (p.items) {
    if (p.path === '/') out.push('## Shelves', '', ...entries(p.items), '')
    else if (p.items.length) out.push('## Listings', '', ...entries(p.items), '')
  }
  out.push('---', '', `Page: ${SITE}${p.path === '/' ? '/' : p.path} · Every listing: ${SITE}/llms.txt`, '')
  return out.join('\n')
}

// ── HTML ────────────────────────────────────────────────────────────────────

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
/** A plain line as HTML: `code` spans and URLs kept, everything else escaped. */
export function inline(s: string): string {
  return s
    .split(/(`[^`]+`|https?:\/\/[^\s`<>]+[^\s`<>.,:;)])/)
    .map((t, i) => {
      if (i % 2 === 0) return esc(t)
      if (t.startsWith('`')) return `<code>${esc(t.slice(1, -1))}</code>`
      return `<a href="${esc(t)}">${esc(t)}</a>`
    })
    .join('')
}

/** JSON inside a script element: nothing in it can end the element. */
const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c')

/** The static body: what the page says, readable before (and without) the app. */
function body(p: Page): string {
  const nav = KINDS.map((k) => `<a href="${PATH[k]}">${esc(LABEL[k].many)}</a>`).join(' · ')
  const parts = [`<nav aria-label="${NAME}"><a href="/">${NAME}</a> · ${nav}</nav>`, '<main>', `<h1>${esc(p.title)}</h1>`]
  if (p.summary) parts.push(`<p>${esc(p.summary)}</p>`)
  if (p.facts.length) parts.push(`<dl>${p.facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`)
  if (p.get.cli || p.get.mcp) {
    parts.push('<h2>Get it</h2>')
    if (p.get.cli) parts.push(`<pre><code>${esc(p.get.cli)}</code></pre>`)
    if (p.get.mcp) parts.push(`<p>As a hanzo-mcp call:</p><pre><code>${esc(p.get.mcp)}</code></pre>`)
    parts.push(`<p>Both need a Hanzo credential: <a href="/auth.md">auth.md</a></p>`)
  }
  if (p.links.length) parts.push(`<ul>${p.links.map((l) => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join('')}</ul>`)
  for (const n of p.notes ?? []) parts.push(`<h2>${esc(n.title)}</h2><ul>${n.lines.map((l) => `<li>${inline(l)}</li>`).join('')}</ul>`)
  if (p.doc) parts.push(`<h2>${esc(p.doc.title)}</h2><pre>${esc(p.doc.text)}</pre>`)
  if (p.items?.length) parts.push(`<ul>${p.items.map((i) => `<li><a href="${esc(i.path)}">${esc(i.title)}</a>${i.summary ? ` — ${esc(line(i.summary))}` : ''}</li>`).join('')}</ul>`)
  parts.push(`<p><a href="${esc(twin(p.path))}">This page as Markdown</a></p>`, '</main>')
  return `<div class="static">${parts.join('')}</div>`
}

/** The look of the static body: the theme's own ink on the shell's ground, no wider than a phone. */
const STYLE =
  '<style>.static{box-sizing:border-box;width:100%;max-width:880px;margin:0 auto;padding:48px 16px;font:16px/1.6 system-ui,sans-serif;color:var(--foreground);overflow-wrap:anywhere}' +
  '.static a{color:inherit}.static pre{white-space:pre-wrap}.static dt{font-weight:600}.static dd{margin:0 0 8px}</style>'

function once(doc: string, find: RegExp | string, put: string): string {
  const n = typeof find === 'string' ? doc.split(find).length - 1 : (doc.match(new RegExp(find.source, 'g')) ?? []).length
  if (n !== 1) throw new Error(`the built shell holds ${n} of ${String(find)}, not one: dist/index.html is not the shell this script fills`)
  return doc.replace(find, () => put)
}

/** The built shell (dist/index.html) as this page: its title, description, canonical, twin, JSON-LD and body. */
export function html(shell: string, p: Page): string {
  const title = p.path === '/' ? NAME : `${p.title} — ${NAME}`
  const summary = p.summary || ABOUT
  const head = [
    `<link rel="canonical" href="${esc(SITE + (p.path === '/' ? '/' : p.path))}" />`,
    `<link rel="alternate" type="text/markdown" href="${esc(twin(p.path))}" />`,
    ...(p.hidden ? ['<meta name="robots" content="noindex" />'] : []),
    ...(p.ld ? [`<script type="application/ld+json">${json(p.ld)}</script>`] : []),
    STYLE,
  ].join('\n    ')
  let out = once(shell, /<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
  out = once(out, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(summary)}" />`)
  out = once(out, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(title)}" />`)
  out = once(out, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(summary)}" />`)
  out = once(out, '</head>', `  ${head}\n  </head>`)
  return once(out, '<div id="root"></div>', `<div id="root">${p.hidden ? '' : body(p)}</div>`)
}

/** The document a miss answers with: the app, kept out of search, saying so to a reader without scripts. */
export function missing(shell: string): string {
  let out = once(shell, /<title>[^<]*<\/title>/, `<title>Not found — ${NAME}</title>`)
  out = once(out, '</head>', '  <meta name="robots" content="noindex" />\n  </head>')
  return once(out, '<div id="root"></div>', `<div id="root"></div><noscript><p>No page at this address. <a href="/">${NAME}</a> · <a href="/llms.txt">every listing</a></p></noscript>`)
}

// ── what lists the pages ────────────────────────────────────────────────────

/** Fewer URLs than this in one sitemap file, and fewer bytes (sitemaps.org). */
const URLS = 50_000
const BYTES = 50 * 1024 * 1024

/** sitemap.xml for every page search may show; past either limit, an index over numbered files. */
export function sitemaps(pages: Page[]): Record<string, string> {
  const head = '<?xml version="1.0" encoding="UTF-8"?>\n'
  const urls = pages
    .filter((p) => !p.hidden)
    .map((p) => `<url><loc>${esc(SITE + (p.path === '/' ? '/' : p.path))}</loc>${p.modified ? `<lastmod>${p.modified}</lastmod>` : ''}</url>`)
  const set = (u: string[]) => `${head}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${u.join('\n')}\n</urlset>\n`
  const whole = set(urls)
  if (urls.length <= URLS && whole.length <= BYTES) return { 'sitemap.xml': whole }
  const files: Record<string, string> = {}
  let chunk: string[] = []
  let size = 0
  const flush = () => {
    files[`sitemap-${Object.keys(files).length + 1}.xml`] = set(chunk)
    chunk = []
    size = 0
  }
  for (const u of urls) {
    if (chunk.length >= URLS || size + u.length > BYTES - 200) flush()
    chunk.push(u)
    size += u.length + 1
  }
  if (chunk.length) flush()
  const index = Object.keys(files).map((f) => `<sitemap><loc>${SITE}/${f}</loc></sitemap>`)
  files['sitemap.xml'] = `${head}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${index.join('\n')}\n</sitemapindex>\n`
  return files
}

/** Every <loc> of a sitemap or sitemap index, in order. */
export const locs = (xml: string): string[] => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&#38;|&amp;/g, '&'))

/** llms.txt: the market, what an agent does here, and every listing with its page and twin. */
export function llms(home: Page, registry: number): string {
  const out = [`# ${NAME}`, '', `> ${ABOUT}`, '']
  out.push(
    `The Hanzo marketplace, one catalog over ${GATEWAY}/v1: seller listings (agents to hire, tools sold per call), open-source personas, the apps built on the platform, the platform's skills, and MCP servers. Each listing below has a page and its Markdown twin.`,
    '',
    '## For agents',
    '',
    ...AGENTS.map((a) => `- ${a}`),
    `- The MCP registry mirror (${registry.toLocaleString('en-US')} servers from registry.modelcontextprotocol.io) is searched, not listed: \`GET ${GATEWAY}/v1/tool/catalog?q=<words>\`, one server at \`GET ${GATEWAY}/v1/tool/catalog/{id}\`.`,
    `- Docs: https://docs.hanzo.ai/docs/marketplace · The whole Hanzo API: https://docs.hanzo.ai/llms.txt · Hanzo: https://hanzo.ai/llms.txt`,
    '',
  )
  for (const s of home.items ?? []) {
    out.push(`## ${s.title}`, '', `${line(s.summary)} Shelf: ${SITE}${s.path} ([Markdown](${SITE}${twin(s.path)}))`, '')
    for (const p of s.items ?? []) {
      const off = p.facts.some(([k, v]) => k === OFF_SHOP[0] && v === OFF_SHOP[1]) ? ' Not a shop listing.' : ''
      out.push(`- ${mdLink(p.title, SITE + p.path)}: ${line(p.summary)}${off} [Markdown](${SITE}${twin(p.path)})`)
    }
    out.push('')
  }
  out.push('## Optional', '', `- [Every page in one file](${SITE}/llms-full.txt)`, `- [Sitemap](${SITE}/sitemap.xml)`, '')
  return out.join('\n')
}

/** llms-full.txt: every page's twin, the front first. */
export const llmsFull = (pages: Page[]): string => pages.filter((p) => !p.hidden).map(markdown).join('\n')

// ── what left the catalog ───────────────────────────────────────────────────

/** A page the catalog no longer holds, and where its readers go instead. */
export interface Retired {
  path: string
  to: string
  since: string
}

/** The shelf a listing's path sits under: where a reader of a removed one goes. */
export function successor(path: string): string {
  const top = `/${path.split('/')[1] ?? ''}`
  return Object.values(PATH).includes(top) ? top : '/'
}

/**
 * What left since the last release: every path the live sitemap listed, or the
 * live retired list carried, that this build does not write. A path that came
 * back is dropped; one already retired keeps its date.
 */
export function retire(listed: string[], before: Retired[], now: ReadonlySet<string>, today: string): Retired[] {
  const out = new Map<string, Retired>()
  for (const r of before) if (!now.has(r.path) && writable(r.path)) out.set(r.path, { ...r, to: now.has(r.to) ? r.to : successor(r.path) })
  for (const p of listed) if (!now.has(p) && !out.has(p) && writable(p) && p !== '/') out.set(p, { path: p, to: successor(p), since: today })
  return [...out.values()].toSorted((a, b) => a.path.localeCompare(b.path))
}

/** A retired path's HTML: an immediate move to its successor, which search reads as permanent, and out of the index. */
export function moved(r: Retired): string {
  const to = esc(r.to)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Moved — ${NAME}</title>
    <meta name="robots" content="noindex" />
    <link rel="canonical" href="${esc(SITE + r.to)}" />
    <link rel="alternate" type="text/markdown" href="${esc(twin(r.path))}" />
    <meta http-equiv="refresh" content="0; url=${to}" />
  </head>
  <body>
    <p>This listing left the catalog. <a href="${to}">Continue</a></p>
  </body>
</html>
`
}

export const movedMarkdown = (r: Retired): string =>
  `# Moved\n\nThis listing left the catalog on ${r.since}. Continue at ${SITE}${r.to} (${SITE}${twin(r.to)}).\n`
