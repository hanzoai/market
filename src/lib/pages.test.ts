import type { AppEntry, McpListing, ShopListing, SkillEntry } from '~/lib/market'
import {
  appPage,
  directoryPage,
  esc,
  file,
  front,
  hidden,
  html,
  inline,
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
  successor,
  templatePage,
  twin,
  writable,
  type Page,
} from '~/lib/pages'

const rep = { rating: null, reviews: 0, installs: 0, jobs: { completed: 0, disputed: 0 } }
const listing: ShopListing = {
  id: 'lst_1',
  publisherOrg: 'orbital',
  kind: 'agent',
  tool: 'deep-research',
  title: 'Deep Research',
  description: 'Reads the sources, writes the brief.',
  category: 'Research',
  price: '250',
  currency: 'USD',
  public: true,
  docs: '/docs/agents',
  createdAt: 1_790_737_083,
  updatedAt: 1_790_823_483,
  seller: { org: 'orbital', documented: true, reputation: rep },
  reputation: rep,
  links: { docs: '/docs/agents', cli: 'hanzo marketplace jobs create --listing lst_1 --brief <brief> --amount <usd>', mcp: { tool: 'marketplace', op: 'post_marketplace_jobs' } },
}
const app: AppEntry = {
  id: 'hanzo/cli',
  org: 'hanzo',
  name: 'cli',
  kind: 'repo',
  origin: 'product',
  language: 'Rust',
  description: 'The Hanzo CLI.',
  url: 'https://hanzo.sh',
  repo: 'https://github.com/hanzoai/cli',
  forkable: true,
  updated: '2026-10-27T03:57:42Z',
  license: 'MIT',
  upstream: 'someone/cli',
}
const skill: SkillEntry = { name: 'account_appearance', service: 'account', description: 'Read account appearance.', path: 'account_appearance/SKILL.md', sha256: 'abc' }
const server: McpListing = {
  id: 'hanzo-mcp',
  name: 'hanzo-mcp',
  title: 'Hanzo MCP',
  vendor: 'Hanzo AI',
  description: 'Tools over MCP.',
  repo: 'https://github.com/hanzoai/mcp',
  site: 'https://docs.hanzo.ai/docs/mcp',
  version: '1.0.0',
  transports: ['stdio'],
  featured: true,
  official: true,
}
const SHELL = `<!doctype html>
<html lang="en">
  <head>
    <title>Hanzo Market</title>
    <meta name="description" content="Agents, apps, skills and MCP servers." />
    <meta property="og:title" content="Hanzo Market" />
    <meta property="og:description" content="Agents." />
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

describe('addresses', () => {
  it('names a page’s twin and file the way the edge resolves them', () => {
    expect(twin('/')).toBe('/index.md')
    expect(twin('/apps/hanzo/next.js')).toBe('/apps/hanzo/next.js.md')
    expect(file('/')).toBe('index.html')
    expect(file('/l/lst_1')).toBe('l/lst_1/index.html')
  })

  it('writes only paths the export holds as they are', () => {
    for (const ok of ['/', '/l/lst_1', '/apps/hanzo/next.js', '/personas/al_kindi', '/mcp/hanzo-mcp']) expect(writable(ok), ok).toBe(true)
    for (const no of ['/apps/hanzo/.profile', '/a/../b', '/a b', '/a/', '/x/readme.md', '/x/page.html', '/%2e']) expect(writable(no), no).toBe(false)
  })
})

describe('listing pages', () => {
  it('a shop listing carries its price, the platform’s own command and an Offer', () => {
    const p = shopPage(listing)
    expect(p.path).toBe('/l/lst_1')
    expect(p.kind).toBe('agent')
    expect(p.facts).toEqual([
      ['Type', 'Agent'],
      ['Publisher', 'orbital'],
      ['Category', 'Research'],
      ['Price', '$250.00 per job'],
      ['Listed', '2026-09-30'],
    ])
    expect(p.get.cli).toBe(listing.links.cli)
    expect(JSON.parse(p.get.mcp ?? '')).toEqual({ name: 'marketplace', arguments: { op: 'post_marketplace_jobs', input: { listing: 'lst_1', brief: '<brief>', amount: '<usd>' } } })
    expect(p.links[0]).toEqual({ label: 'Documentation', href: 'https://docs.hanzo.ai/docs/agents' })
    expect(p.ld?.offers).toEqual({ '@type': 'Offer', price: '250', priceCurrency: 'USD', url: `${SITE}/l/lst_1` })
    expect(p.modified).toBe('2026-10-01')
    expect(shopPage({ ...listing, price: '0', category: '', docs: undefined, links: { ...listing.links, docs: undefined } }).facts).toContainEqual(['Price', 'Free'])
  })

  it('a directory entry says it is not in the shop and names no price', () => {
    const p = directoryPage({ ...listing, id: 'lst_agent_sec', docs: 'https://github.com/hanzoai/agents', links: { ...listing.links, docs: undefined } })
    expect(p.facts).toContainEqual(['Shop', 'Not a shop listing'])
    expect(p.facts.map(([k]) => k)).not.toContain('Price')
    expect(p.get).toEqual({ cli: null, mcp: null })
    expect(p.ld?.offers).toBeUndefined()
    expect(p.links).toEqual([{ label: 'Source', href: 'https://github.com/hanzoai/agents' }])
    expect(directoryPage({ ...listing, docs: undefined, links: { ...listing.links, docs: undefined } }).links).toEqual([])
  })

  it('an MCP server of the directory links its site and source once each', () => {
    const p = serverPage(server)
    expect(p.path).toBe('/mcp/hanzo-mcp')
    expect(p.links).toEqual([
      { label: 'Website', href: 'https://docs.hanzo.ai/docs/mcp' },
      { label: 'Source', href: 'https://github.com/hanzoai/mcp' },
    ])
    expect(serverPage({ ...server, site: server.repo }).links).toHaveLength(1)
  })

  it('an app says what the catalog says, and what it is when the catalog has no description', () => {
    const p = appPage(app)
    expect(p.path).toBe('/apps/hanzo/cli')
    expect(p.facts).toEqual([
      ['Type', 'App'],
      ['Publisher', 'hanzo'],
      ['Category', 'repository'],
      ['Language', 'Rust'],
      ['License', 'MIT'],
      ['Upstream', 'someone/cli'],
      ['Updated', '2026-10-27'],
    ])
    expect(p.links.map((l) => l.label)).toEqual(['Open', 'Source', 'Catalog search for it as JSON (no key)'])
    expect(p.ld?.sameAs).toEqual(['https://hanzo.sh/', 'https://github.com/hanzoai/cli'])
    expect(p.ld?.dateModified).toBe(app.updated)
    expect(p.modified).toBe('2026-10-27')
    const bare = appPage({ ...app, kind: 'site', description: undefined, language: undefined, url: 'javascript:alert(1)', repo: undefined, updated: undefined, archetype: undefined })
    expect(bare.summary).toBe('site by hanzo.')
    expect(bare.links.map((l) => l.label)).toEqual(['Catalog search for it as JSON (no key)'])
    expect(bare.ld?.sameAs).toEqual([])
    expect(appPage({ ...app, description: '', archetype: 'sdk' }).summary).toBe('Rust sdk by hanzo.')
  })

  it('a skill links its SKILL.md and its digest', () => {
    const p = skillPage(skill, 'https://api.hanzo.ai')
    expect(p.links).toEqual([{ label: 'SKILL.md', href: 'https://api.hanzo.ai/.well-known/agent-skills/account_appearance/SKILL.md' }])
    expect(p.facts).toContainEqual(['SHA-256', 'abc'])
    expect(skillPage({ ...skill, sha256: undefined }, 'https://api.hanzo.ai').facts.map(([k]) => k)).not.toContain('SHA-256')
  })

  it('a persona carries its definition when the storefront has one', () => {
    const p = personaPage({ slug: 'ada', name: 'Ada Lovelace', called: 'Ada', category: 'early_pioneer', about: 'A mathematician.', based: 'Ada King' }, '---\nname: Ada\n---\nBody\n')
    expect(p.title).toBe('Ada Lovelace (Ada)')
    expect(p.facts).toContainEqual(['Category', 'early pioneer'])
    expect(p.doc).toEqual({ title: 'Definition', text: '---\nname: Ada\n---\nBody' })
    expect(p.links.map((l) => l.href)).toEqual(['https://github.com/hanzoai/personas/tree/main/personas/ada', `${SITE}/personas/ada/PERSONA.md`])
    const plain = personaPage({ slug: 'zu', name: 'Zu', category: 'mathematician' }, '')
    expect(plain.doc).toBeUndefined()
    expect(plain.links).toHaveLength(1)
  })

  it('a template is the gallery’s entry, its links to be checked', () => {
    const p = templatePage({ slug: 'synapse', title: 'Synapse', category: 'AI', description: 'Chat.', github: 'https://github.com/x/y', preview: 'https://synapse.example' })
    expect(p.links.map((l) => l.label)).toEqual(['Preview', 'Source'])
    expect(templatePage({ slug: 's', title: 'S', category: 'c', description: '' }).links).toEqual([])
  })
})

describe('links', () => {
  it('keeps only what answered, in the links and in what JSON-LD says the thing is', () => {
    const p = appPage(app)
    expect(outside(p)).toEqual(['https://hanzo.sh/', 'https://github.com/hanzoai/cli', p.links[2].href, 'https://hanzo.sh/', 'https://github.com/hanzoai/cli'])
    const kept = prune(p, (u) => u.includes('github.com'))
    expect(kept.links.map((l) => l.label)).toEqual(['Source'])
    expect(kept.ld?.sameAs).toEqual(['https://github.com/hanzoai/cli'])
    expect(prune(p, () => false).ld).not.toHaveProperty('sameAs')
    expect(prune(shopPage(listing), () => false).links).toEqual([])
    expect(prune(personaPage({ slug: 'a', name: 'A', category: 'c' }, 'doc'), () => false).links).toEqual([{ label: 'PERSONA.md', href: `${SITE}/personas/a/PERSONA.md` }])
  })
})

describe('shelves and the front', () => {
  const items = [shopPage(listing), directoryPage({ ...listing, id: 'lst_agent_x', title: 'X [beta]' })]
  const agents = shelf('agent', items)
  const home = front([agents, shelf('mcp', [], [{ title: 'The MCP registry', lines: ['Search `GET /v1/tool/catalog`.'] }])])

  it('counts what a shelf holds and names the collection', () => {
    expect(agents.path).toBe('/agents')
    expect(agents.summary).toMatch(/2 listed\.$/)
    expect(agents.ld?.['@type']).toBe('CollectionPage')
    expect(home.ld?.potentialAction).toMatchObject({ target: `${SITE}/?q={search_term_string}` })
  })

  it('writes the twin: title, summary, facts, how to get it, links, notes, listings', () => {
    const md = markdown(shopPage(listing))
    expect(md.startsWith('# Deep Research\n\n> Reads the sources, writes the brief.\n\n- Type: Agent\n')).toBe(true)
    expect(md).toContain('## Get it\n\n```sh\nhanzo marketplace jobs create')
    expect(md).toContain('As a hanzo-mcp call')
    expect(md).toContain(`Both need a Hanzo credential: ${SITE}/auth.md`)
    expect(md).toContain('- [Documentation](https://docs.hanzo.ai/docs/agents)')
    expect(md.endsWith(`Page: ${SITE}/l/lst_1 · Every listing: ${SITE}/llms.txt\n`)).toBe(true)
    const shelfMd = markdown(agents)
    expect(shelfMd).toContain('## Listings\n\n- [Deep Research](https://hanzo.market/l/lst_1): Reads the sources, writes the brief.')
    expect(shelfMd).toContain('- [X \\[beta\\]](https://hanzo.market/l/lst_agent_x)')
    const frontMd = markdown(home)
    expect(frontMd).toContain('## For agents\n\n- Read the catalog with no key')
    expect(frontMd).toContain('## Shelves\n\n- [Agents](https://hanzo.market/agents)')
    expect(frontMd).toContain(`Page: ${SITE}/ ·`)
    expect(markdown(shelf('tool', []))).not.toContain('## Listings')
    expect(markdown(personaPage({ slug: 'a', name: 'A', category: 'c' }, 'doc'))).toContain('## Definition\n\n````markdown\ndoc\n````')
    expect(markdown({ ...shopPage(listing), get: { cli: null, mcp: null }, summary: '', links: [{ label: 'x', href: 'https://a.example/b (c)' }] })).toContain('- [x](<https://a.example/b (c)>)')
  })

  it('makes every private page a shell without a body, out of search', () => {
    const p = hidden(PRIVATE[0])
    expect(p).toMatchObject({ path: '/login', hidden: true, ld: null })
    const doc = html(SHELL, p)
    expect(doc).toContain('<meta name="robots" content="noindex" />')
    expect(doc).toContain('<div id="root"></div>')
    expect(sitemaps([p])['sitemap.xml']).not.toContain('/login')
    expect(llmsFull([p, agents])).not.toContain('# Sign in')
  })
})

describe('HTML', () => {
  it('fills the shell: title, description, canonical, twin, JSON-LD and a static body, all escaped', () => {
    const doc = html(SHELL, shopPage({ ...listing, title: 'A <b> & "c"', description: '</script><script>alert(1)</script>' }))
    expect(doc).toContain('<title>A &#60;b&#62; &#38; &#34;c&#34; — Hanzo Market</title>')
    expect(doc).toContain(`<link rel="canonical" href="${SITE}/l/lst_1" />`)
    expect(doc).toContain('<link rel="alternate" type="text/markdown" href="/l/lst_1.md" />')
    expect(doc).not.toContain('</script><script>alert(1)')
    expect(doc).toContain('\\u003c/script>')
    expect(doc).toContain('<div id="root"><div class="static">')
    expect(doc).toContain('<a href="/l/lst_1.md">This page as Markdown</a>')
    expect(doc).toContain('<script type="module" crossorigin src="/assets/index-abc.js"></script>')
    const home = html(SHELL, front([shelf('agent', [shopPage(listing)])]))
    expect(home).toContain('<title>Hanzo Market</title>')
    expect(home).toContain(`<link rel="canonical" href="${SITE}/" />`)
    expect(home).toContain('<h2>For agents</h2>')
    expect(html(SHELL, personaPage({ slug: 'a', name: 'A', category: 'c' }, 'x < y'))).toContain('<pre>x &#60; y</pre>')
  })

  it('refuses a shell that is not the one it fills', () => {
    expect(() => html(SHELL.replace('<div id="root"></div>', ''), shopPage(listing))).toThrow(/holds 0 of <div id="root"><\/div>/)
    expect(() => html(SHELL.replace('</title>', '</title><title>x</title>'), shopPage(listing))).toThrow(/holds 2/)
  })

  it('keeps code and URLs in a plain line, escaping the rest', () => {
    expect(inline('Run `a <b>` at https://x.example/p?q=1, then <stop>.')).toBe(
      'Run <code>a &#60;b&#62;</code> at <a href="https://x.example/p?q=1">https://x.example/p?q=1</a>, then &#60;stop&#62;.',
    )
    expect(esc(`'`)).toBe('&#39;')
  })

  it('answers a miss with the app, out of search, and words for a reader without scripts', () => {
    const doc = missing(SHELL)
    expect(doc).toContain('<title>Not found — Hanzo Market</title>')
    expect(doc).toContain('<meta name="robots" content="noindex" />')
    expect(doc).toContain('<div id="root"></div><noscript>')
  })
})

describe('what lists the pages', () => {
  const pages: Page[] = [front([]), shopPage(listing), appPage(app)]

  it('one sitemap with a lastmod only where a source dates the page', () => {
    const files = sitemaps(pages)
    expect(Object.keys(files)).toEqual(['sitemap.xml'])
    const xml = files['sitemap.xml']
    expect(xml).toContain(`<url><loc>${SITE}/</loc></url>`)
    expect(xml).toContain(`<url><loc>${SITE}/l/lst_1</loc><lastmod>2026-10-01</lastmod></url>`)
    expect(locs(xml)).toEqual([`${SITE}/`, `${SITE}/l/lst_1`, `${SITE}/apps/hanzo/cli`])
  })

  it('an index over numbered files past 50,000 URLs', () => {
    const many = Array.from({ length: 50_001 }, (_, i) => ({ ...front([]), path: `/p/${i}` }))
    const files = sitemaps(many)
    expect(Object.keys(files)).toEqual(['sitemap-1.xml', 'sitemap-2.xml', 'sitemap.xml'])
    expect(files['sitemap.xml']).toContain('<sitemapindex')
    expect(locs(files['sitemap.xml'])).toEqual([`${SITE}/sitemap-1.xml`, `${SITE}/sitemap-2.xml`])
    expect(locs(files['sitemap-2.xml'])).toEqual([`${SITE}/p/50000`])
    expect(locs('<loc>https://a/?x=1&amp;y=2</loc>')).toEqual(['https://a/?x=1&y=2'])
  })

  it('llms.txt names every listing with its page and twin, and which are not in the shop', () => {
    const home = front([shelf('agent', [shopPage(listing), directoryPage({ ...listing, id: 'lst_agent_sec', title: 'Sec' })])])
    const txt = llms(home, 51_266)
    expect(txt.startsWith('# Hanzo Market\n\n> ')).toBe(true)
    expect(txt).toContain('## For agents')
    expect(txt).toContain('51,266 servers')
    expect(txt).toContain(`- [Deep Research](${SITE}/l/lst_1): Reads the sources, writes the brief. [Markdown](${SITE}/l/lst_1.md)`)
    expect(txt).toContain(`- [Sec](${SITE}/l/lst_agent_sec): Reads the sources, writes the brief. Not a shop listing. [Markdown](${SITE}/l/lst_agent_sec.md)`)
    expect(txt).toContain(`Shelf: ${SITE}/agents ([Markdown](${SITE}/agents.md))`)
  })
})

describe('what left the catalog', () => {
  it('sends a removed listing to its shelf, keeps an old move’s date, and forgets one that came back', () => {
    expect(successor('/apps/hanzo/gone')).toBe('/apps')
    expect(successor('/l/lst_gone')).toBe('/')
    expect(successor('/nowhere')).toBe('/')
    const now = new Set(['/', '/apps', '/skills', '/apps/hanzo/back'])
    const before = [
      { path: '/apps/hanzo/old', to: '/apps', since: '2026-10-01' },
      { path: '/apps/hanzo/back', to: '/apps', since: '2026-10-02' },
      { path: '/skills/gone', to: '/skills/elsewhere', since: '2026-10-03' },
      { path: '/bad path', to: '/', since: '2026-10-03' },
    ]
    expect(retire(['/', '/apps', '/apps/hanzo/new', '/apps/hanzo/old', '/apps/hanzo/back'], before, now, '2026-10-27')).toEqual([
      { path: '/apps/hanzo/new', to: '/apps', since: '2026-10-27' },
      { path: '/apps/hanzo/old', to: '/apps', since: '2026-10-01' },
      { path: '/skills/gone', to: '/skills', since: '2026-10-03' },
    ])
  })

  it('a moved page sends its reader on at once and stays out of search', () => {
    const r = { path: '/apps/hanzo/old', to: '/apps', since: '2026-10-01' }
    const doc = moved(r)
    expect(doc).toContain('<meta http-equiv="refresh" content="0; url=/apps" />')
    expect(doc).toContain(`<link rel="canonical" href="${SITE}/apps" />`)
    expect(doc).toContain('<meta name="robots" content="noindex" />')
    expect(movedMarkdown(r)).toBe(`# Moved\n\nThis listing left the catalog on 2026-10-01. Continue at ${SITE}/apps (${SITE}/apps.md).\n`)
  })
})
