import { account, links, MOST, own, pull, repos, shipped, site, skills, spoken, suggested, zoneOf, type Repo } from '~/lib/github'
import { Refusal, Silence } from '~/lib/http'

const repo = (full: string, over: Partial<Repo> = {}): Repo => ({ full, fork: false, archived: false, language: '', topics: [], stars: 0, url: `https://github.com/${full}`, pushed: '2026-11-01T00:00:00Z', ...over })

describe('what they made', () => {
  it('leaves out forks, archives and rows with no name', () => {
    const all = [repo('ada/a'), repo('ada/b', { fork: true }), repo('ada/c', { archived: true }), repo('', {})]
    expect(own(all).map((r) => r.full)).toEqual(['ada/a'])
  })

  it('names the languages most used in their own repositories, then their topics, each once', () => {
    const all = [
      repo('ada/a', { language: 'Go', topics: ['cli', 'base'] }),
      repo('ada/b', { language: 'Go', topics: ['base'] }),
      repo('ada/c', { language: 'TypeScript', topics: ['go'] }),
      repo('ada/d', { language: 'Rust', fork: true, topics: ['forked'] }),
      repo('ada/e', { language: '' }),
    ]
    expect(skills(all)).toEqual(['Go', 'TypeScript', 'base', 'cli'])
    expect(skills([])).toEqual([])
  })

  it('stops at what a card can carry', () => {
    const all = Array.from({ length: 30 }, (_, i) => repo(`ada/r${i}`, { language: `L${i % 7}`, topics: [`t${i}`] }))
    expect(skills(all)).toHaveLength(MOST.skills)
  })

  it('names the most-starred of their own, since the public API does not say which are pinned', () => {
    const all = [repo('ada/a', { stars: 3 }), repo('ada/b', { stars: 9 }), repo('ada/c', { stars: 0 }), repo('ada/d', { stars: 9, pushed: '2026-12-01T00:00:00Z' }), repo('ada/e', { stars: 5 }), repo('ada/f', { stars: 50, fork: true })]
    expect(shipped(all).map((r) => r.full)).toEqual(['ada/d', 'ada/b', 'ada/e'])
  })
})

describe('links', () => {
  it('makes an address https and drops what is not one', () => {
    expect(site('ada.dev')).toBe('https://ada.dev/')
    expect(site('http://ada.dev/x')).toBe('https://ada.dev/x')
    expect(site('  ')).toBeNull()
    expect(site('javascript:alert(1)')).toBeNull()
    expect(site('ftp://ada.dev')).toBeNull()
    expect(site('localhost')).toBeNull()
    expect(site('https://u:p@ada.dev')).toBeNull()
    expect(site('http://')).toBeNull()
  })

  it('lists their profile, their site, then what they shipped, each once and at most eight', () => {
    const made = [repo('ada/a'), repo('ada/b')]
    expect(links({ url: 'https://github.com/ada', blog: 'ada.dev' }, made)).toEqual(['https://github.com/ada', 'https://ada.dev/', 'https://github.com/ada/a', 'https://github.com/ada/b'])
    expect(links({ url: 'https://github.com/ada', blog: 'github.com/ada' }, [])).toEqual(['https://github.com/ada'])
    expect(links({ url: '', blog: '' }, [])).toEqual([])
    expect(links({ url: `https://github.com/${'x'.repeat(200)}`, blog: '' }, [])).toEqual([])
    expect(links({ url: 'https://github.com/ada', blog: '' }, Array.from({ length: 12 }, (_, i) => repo(`ada/r${i}`)))).toHaveLength(MOST.links)
  })
})

describe('the areas their dependencies suggest', () => {
  it('reads Hanzo and Lux packages and modules out of a package.json and a go.mod', () => {
    const pkg = '{"dependencies":{"@hanzo/base":"^1","@hanzo/commerce":"1","react":"19"},"devDependencies":{"@hanzogui/core":"1"}}'
    const mod = 'module x\n\nrequire (\n\tgithub.com/hanzoai/bot v1.2.3\n\tgithub.com/luxfi/node v1.0.0\n\tgithub.com/other/thing v1\n)\n'
    expect(suggested([pkg, mod]).toSorted()).toEqual(['base', 'bot', 'commerce', 'freelance'])
  })

  it('maps each product to its area', () => {
    const area = (dep: string) => suggested([`"@hanzo/${dep}": "1"`])
    expect(area('agents')).toEqual(['agents'])
    expect(area('agent')).toEqual(['agents'])
    expect(area('cloud')).toEqual(['cloud'])
    expect(area('ai')).toEqual(['models'])
    expect(area('zen')).toEqual(['models'])
    expect(area('studio')).toEqual(['creative'])
    expect(area('iam')).toEqual(['freelance'])
  })

  it('suggests nothing from manifests that name none of them', () => {
    expect(suggested(['{"dependencies":{"react":"19","@types/node":"1"}}', 'module x\nrequire github.com/other/thing v1'])).toEqual([])
    expect(suggested([])).toEqual([])
  })
})

describe('where they are', () => {
  const zones = ['America/Los_Angeles', 'America/New_York', 'Europe/Berlin', 'Asia/Kolkata', 'America/Argentina/Buenos_Aires', 'Europe/Paris']

  it('finds an IANA city by its name, then a place by what is written for it', () => {
    expect(zoneOf('Berlin, Germany', zones)).toBe('Europe/Berlin')
    expect(zoneOf('New York', zones)).toBe('America/New_York')
    expect(zoneOf('San Francisco, CA', zones)).toBe('America/Los_Angeles')
    expect(zoneOf('Somewhere, India', zones)).toBe('Asia/Kolkata')
    expect(zoneOf('PARIS', zones)).toBe('Europe/Paris')
    expect(zoneOf('Buenos Aires', zones)).toBe('America/Argentina/Buenos_Aires')
  })

  it('names none for a place it does not know, or a zone the runtime lacks', () => {
    expect(zoneOf('The Internet', zones)).toBe('')
    expect(zoneOf('', zones)).toBe('')
    expect(zoneOf('Tokyo, Japan', zones)).toBe('')
    expect(zoneOf('Seattle')).toBe(Intl.supportedValuesOf('timeZone').includes('America/Los_Angeles') ? 'America/Los_Angeles' : '')
  })
})

describe('the browser’s languages', () => {
  it('maps tags to the form’s codes, first three, each once', () => {
    expect(spoken(['en-US', 'en', 'zh-CN', 'pt-BR', 'fr'])).toEqual(['en', 'zh-cn', 'pt'])
    expect(spoken(['xx-YY', 'tlh'])).toEqual([])
    expect(spoken([])).toEqual([])
  })
})

describe('the reads', () => {
  let asked: string[] = []
  const answer = (body: unknown, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })

  beforeEach(() => {
    asked = []
  })
  afterEach(() => vi.unstubAllGlobals())

  const serve = (routes: Record<string, () => Response>) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string) => {
        asked.push(u)
        const hit = Object.entries(routes).find(([k]) => u.includes(k))
        if (!hit) return answer('', 404)
        return hit[1]()
      }),
    )

  it('reads the linked account by the id IAM stores', async () => {
    serve({ '/user/424242': () => answer({ login: 'ada', name: 'Ada Lovelace', bio: 'Engines', company: '@babbage', blog: 'ada.dev', location: 'Berlin', html_url: 'https://github.com/ada' }) })
    expect(await account('424242')).toEqual({ login: 'ada', name: 'Ada Lovelace', bio: 'Engines', company: '@babbage', blog: 'ada.dev', location: 'Berlin', url: 'https://github.com/ada' })
    expect(asked).toEqual(['https://api.github.com/user/424242'])
  })

  it('says why a read failed: a limit, a missing account, no answer, a record with no login', async () => {
    serve({ '/user/1': () => answer({}, 403) })
    await expect(account('1')).rejects.toMatchObject({ status: 403, message: expect.stringContaining('limiting') })
    serve({ '/user/2': () => answer({}, 404) })
    await expect(account('2')).rejects.toMatchObject({ status: 404, message: 'GitHub has no such account.' })
    serve({ '/user/3': () => answer({}, 500) })
    await expect(account('3')).rejects.toMatchObject({ status: 500, message: 'GitHub answered 500.' })
    serve({ '/user/4': () => answer({ name: 'x' }) })
    await expect(account('4')).rejects.toBeInstanceOf(Refusal)
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
    await expect(account('5')).rejects.toBeInstanceOf(Silence)
  })

  it('reads their repositories, newest push first as GitHub orders them', async () => {
    serve({ '/users/ada/repos': () => answer([{ full_name: 'ada/a', fork: false, language: 'Go', topics: ['x', 5], stargazers_count: 7, html_url: 'https://github.com/ada/a', pushed_at: '2026-11-01T00:00:00Z' }, { full_name: 'ada/b' }]) })
    const got = await repos('ada')
    expect(got[0]).toEqual({ full: 'ada/a', fork: false, archived: false, language: 'Go', topics: ['x'], stars: 7, url: 'https://github.com/ada/a', pushed: '2026-11-01T00:00:00Z' })
    expect(got[1]).toMatchObject({ full: 'ada/b', language: '', topics: [], stars: 0 })
    expect(asked[0]).toContain('per_page=100&type=owner&sort=pushed')
    serve({ '/users/ada/repos': () => answer({ message: 'no' }) })
    expect(await repos('ada')).toEqual([])
  })

  it('pulls a whole proposal: name, bio, skills, links, a zone, and the areas its repositories’ manifests suggest', async () => {
    serve({
      '/user/7': () => answer({ login: 'ada', name: 'Ada Lovelace', bio: 'Engines', blog: 'ada.dev', location: 'Berlin, Germany', html_url: 'https://github.com/ada' }),
      '/users/ada/repos': () =>
        answer([
          { full_name: 'ada/engine', language: 'Go', topics: ['base'], stargazers_count: 12, html_url: 'https://github.com/ada/engine', pushed_at: '2026-11-02T00:00:00Z' },
          { full_name: 'ada/site', language: 'TypeScript', topics: [], stargazers_count: 0, html_url: 'https://github.com/ada/site', pushed_at: '2026-11-01T00:00:00Z' },
          { full_name: 'x/forked', fork: true, language: 'Rust', html_url: 'https://github.com/x/forked' },
        ]),
      'raw.githubusercontent.com/ada/engine/HEAD/go.mod': () => answer('module x\nrequire github.com/hanzoai/base v1.0.0\n'),
      'raw.githubusercontent.com/ada/site/HEAD/package.json': () => answer('{"dependencies":{"@hanzo/commerce":"1"}}'),
    })
    const got = await pull('7')
    expect(got).toMatchObject({ login: 'ada', name: 'Ada Lovelace', bio: 'Engines', skills: ['Go', 'TypeScript', 'base'], timezone: 'Europe/Berlin' })
    expect(got.areas.toSorted()).toEqual(['base', 'commerce'])
    expect(got.links).toEqual(['https://github.com/ada', 'https://ada.dev/', 'https://github.com/ada/engine'])
    expect(asked.some((u) => u.includes('forked'))).toBe(false)
  })

  it('reads a repository whose raw files cannot be had as having no manifests', async () => {
    serve({
      '/user/8': () => answer({ login: 'ada' }),
      '/users/ada/repos': () => answer([{ full_name: 'ada/a', html_url: 'https://github.com/ada/a' }]),
    })
    expect((await pull('8')).areas).toEqual([])
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string) => {
        if (u.includes('raw.githubusercontent')) throw new Error('offline')
        return u.includes('/repos') ? answer([{ full_name: 'ada/a' }]) : answer({ login: 'ada' })
      }),
    )
    expect((await pull('8')).areas).toEqual([])
  })
})
