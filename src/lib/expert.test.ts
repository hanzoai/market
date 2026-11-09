import {
  AREAS,
  areaLabel,
  change,
  check,
  asked,
  availability,
  create,
  every,
  facts,
  fees,
  fill,
  FREELANCE,
  hoursOf,
  isArea,
  isProduct,
  keep,
  language,
  LANGUAGES,
  link,
  mine,
  opening,
  PAGE,
  productLabel,
  PRODUCTS,
  profile,
  refresh,
  shelf,
  SORTS,
  start,
  TIERS,
  zone,
  zones,
  type Form,
} from '~/lib/expert'
import type { Listing, ShopListing } from '~/lib/market'

const rep = { rating: 4.8, reviews: 23, installs: 0, jobs: { completed: 5, disputed: 0 } }
const expert = { rate: '150', areas: ['base', 'cloud'], languages: ['en', 'es'], timezone: 'America/Los_Angeles', availability: 'Weekdays 9-17 PT', verified: true }
const row = (id: string, over: Partial<ShopListing> = {}): ShopListing => ({
  id,
  publisherOrg: 'acme',
  kind: 'expert',
  tool: '',
  title: 'Ada Lovelace',
  description: 'Builds on Base.',
  category: '',
  price: '0',
  currency: 'USD',
  public: true,
  createdAt: 1,
  updatedAt: 1,
  seller: { org: 'acme', documented: true, reputation: rep },
  reputation: rep,
  links: { cli: 'hanzo marketplace jobs create', mcp: { tool: 'marketplace', op: 'post_marketplace_jobs' } },
  expert,
  ...over,
})

const form: Form = {
  title: ' Ada Lovelace ',
  description: ' Builds on Base. ',
  rate: '150',
  price: '',
  areas: ['cloud', 'base'],
  languages: ['en', 'es'],
  timezone: 'America/Los_Angeles',
  hours: 'part-time',
  note: ' Weekdays 9-17 PT ',
  fee: 'rate',
  skills: ['TypeScript', 'Go'],
  links: ['https://github.com/ada'],
  recipient: 'wal_acme',
}

describe('areas', () => {
  it('is the closed list, in order, with the names people read', () => {
    expect(AREAS.map((a) => a.slug)).toEqual(['configure', 'base', 'commerce', 'bot', 'agents', 'cloud', 'models', 'creative', 'freelance'])
    expect(areaLabel('configure')).toBe('Configure Hanzo')
    expect(areaLabel('base')).toBe('Build with Base')
    expect(areaLabel('models')).toBe('Kai, Enso, Zen')
    expect(areaLabel('creative')).toBe('Creative AI')
    expect(areaLabel('freelance')).toBe('Freelance')
    expect(areaLabel('unheard-of')).toBe('unheard-of')
    expect(FREELANCE).toBe('Freelance work for partners and companies building on Hanzo Cloud and the Hanzo OSS ecosystem')
    expect(AREAS.every((a) => isArea(a.slug))).toBe(true)
    expect(isArea('web3')).toBe(false)
    expect(isArea(undefined)).toBe(false)
  })
})

describe('languages and zones', () => {
  it('names a code in English, and keeps one it cannot name', () => {
    expect(language('en')).toBe('English')
    expect(language('es')).toBe('Spanish')
    expect(language('zh-cn')).toContain('Chinese')
    expect(language('not a code')).toBe('not a code')
    expect(LANGUAGES.every((c) => language(c) !== c)).toBe(true)
  })

  it('knows an IANA zone from a word or an offset', () => {
    expect(zone('America/Los_Angeles')).toBe(true)
    expect(zone('UTC')).toBe(true)
    expect(zone('')).toBe(false)
    expect(zone('+01:00')).toBe(false)
    expect(zone('Mars/Base')).toBe(false)
  })

  it('lists every zone and keeps the expert’s own when the runtime does not name it', () => {
    expect(zones('America/Los_Angeles')).toContain('Europe/Paris')
    expect(zones('America/Los_Angeles')[0]).not.toBe('America/Los_Angeles')
    expect(zones('Etc/Nowhere')[0]).toBe('Etc/Nowhere')
    expect(zones('')).toEqual(Intl.supportedValuesOf('timeZone'))
  })
})

describe('reading the shop', () => {
  it('pages 200 at a time until the total is read', async () => {
    const asks: [number, number][] = []
    const rows = Array.from({ length: 450 }, (_, i) => row(`lst_${i}`))
    const got = await every(async (offset, limit) => {
      asks.push([offset, limit])
      return { listings: rows.slice(offset, offset + limit), total: rows.length }
    })
    expect(got).toHaveLength(450)
    expect(got.map((l) => l.id)).toEqual(rows.map((l) => l.id))
    expect(asks).toEqual([[0, PAGE], [200, PAGE], [400, PAGE]])
    expect(PAGE).toBe(200)
  })

  it('is one read for a short shelf, and stops at a page the server leaves empty', async () => {
    let n = 0
    await every(async () => (n++, { listings: [row('lst_1')], total: 1 }))
    expect(n).toBe(1)
    let m = 0
    const got = await every(async () => (m++, { listings: [], total: 5 }))
    expect(got).toEqual([])
    expect(m).toBe(1)
  })

  it('reads a profile from an expert and from nothing else', () => {
    expect(profile(row('a'))).toEqual({ ...expert, price: '0', rating: 4.8, reviews: 23, jobs: 5 })
    expect(profile(row('a', { kind: 'agent' }))).toBeUndefined()
    expect(profile(row('a', { expert: undefined }))).toBeUndefined()
  })

  it('states what they ask: by the hour, by the engagement, or both', () => {
    expect(fees({ rate: '150', price: '0' })).toEqual(['$150.00/hr'])
    expect(fees({ rate: '0', price: '500' })).toEqual(['$500.00 fixed'])
    expect(fees({ rate: '150.5', price: '500' })).toEqual(['$150.50/hr', '$500.00 fixed'])
    expect(fees({ rate: '0', price: '0' })).toEqual([])
  })

  it('lists the facts a page and its twin state', () => {
    expect(facts(profile(row('a', { price: '500' }))!)).toEqual([
      ['Areas', 'Build with Base, Cloud'],
      ['Rate', '$150.00/hr'],
      ['Fixed price', '$500.00'],
      ['Languages', 'English, Spanish'],
      ['Time zone', 'America/Los_Angeles'],
      ['Availability', 'Weekdays 9-17 PT'],
      ['Verified', 'Yes'],
    ])
    const bare = facts(profile(row('a', { expert: { ...expert, rate: '0', availability: '', verified: false }, price: '0' }))!)
    expect(bare.map(([k]) => k)).toEqual(['Areas', 'Languages', 'Time zone', 'Verified'])
    expect(bare.at(-1)).toEqual(['Verified', 'No'])
  })

  it('opens a hire at the fixed price, else an hour of the rate; other listings at their price', () => {
    expect(opening(row('a', { price: '500' }))).toBe('500.00')
    expect(opening(row('a', { price: '0' }))).toBe('150.00')
    expect(opening(row('a', { price: '0', expert: { ...expert, rate: '0' } }))).toBe('')
    expect(opening(row('a', { price: '0', expert: { ...expert, rate: '150.555' } }))).toBe('')
    expect(opening(row('a', { kind: 'agent', price: '250', expert: undefined }))).toBe('250.00')
    expect(opening(row('a', { kind: 'agent', price: '0', expert: undefined }))).toBe('')
  })
})

describe('writing a profile', () => {
  it('allows a complete form', () => {
    expect(check(form)).toBeNull()
    expect(check({ ...form, rate: '', price: '500.00' })).toBeNull()
    expect(check({ ...form, rate: '150', price: '500' })).toBeNull()
  })

  it.each([
    [{ title: '  ' }, 'Add your name or a headline.'],
    [{ title: 'x'.repeat(201) }, 'A name or headline is at most 200 characters.'],
    [{ description: 'x'.repeat(4097) }, 'The description is at most 4096 characters.'],
    [{ areas: [] }, 'Pick at least one area.'],
    [{ areas: ['base', 'web3'] }, 'Pick areas from the list.'],
    [{ languages: [] }, 'Pick at least one language.'],
    [{ languages: ['en', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'ru', 'ar'] }, 'Pick at most 8 languages.'],
    [{ languages: ['EN'] }, 'A language is a lowercase code such as en or zh-cn.'],
    [{ timezone: '' }, 'Pick a time zone.'],
    [{ timezone: 'Mars/Base' }, 'Pick a time zone.'],
    [{ hours: '', note: '  ' }, 'Pick your availability.'],
    [{ note: 'x'.repeat(513) }, 'Availability is at most 512 characters.'],
    [{ skills: Array.from({ length: 21 }, (_, i) => `s${i}`) }, 'A skill is at most 40 characters, and there are at most 20.'],
    [{ skills: ['x'.repeat(41)] }, 'A skill is at most 40 characters, and there are at most 20.'],
    [{ skills: [' '] }, 'A skill is at most 40 characters, and there are at most 20.'],
    [{ links: ['http://example.com'] }, 'A link is an https address, and there are at most 8.'],
    [{ links: Array.from({ length: 9 }, (_, i) => `https://example.com/${i}`) }, 'A link is an https address, and there are at most 8.'],
    [{ rate: 'a lot' }, 'A rate or a price is a dollar amount to the cent.'],
    [{ price: '12.345' }, 'A rate or a price is a dollar amount to the cent.'],
    [{ rate: '', price: '' }, 'Name an hourly rate or a fixed price.'],
    [{ rate: '0', price: '0.00' }, 'Name an hourly rate or a fixed price.'],
    [{ recipient: '' }, 'A paid listing needs a payout wallet.'],
  ] as [Partial<Form>, string][])('says why %j cannot be saved', (over, why) => {
    expect(check({ ...form, ...over })).toBe(why)
  })

  it('accepts the limits exactly', () => {
    expect(check({ ...form, title: 'x'.repeat(200), description: 'x'.repeat(4096), hours: '', note: 'x'.repeat(512), languages: ['en', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'ru'] })).toBeNull()
  })

  it('sends exactly the create body: no tool, areas in list order, none as "0", the payout wallet', () => {
    expect(create(form)).toEqual({
      kind: 'expert',
      title: 'Ada Lovelace',
      description: 'Builds on Base.',
      price: '0',
      recipient: 'wal_acme',
      public: true,
      expert: {
        rate: '150',
        areas: ['base', 'cloud'],
        languages: ['en', 'es'],
        timezone: 'America/Los_Angeles',
        availability: 'Part-time · Weekdays 9-17 PT',
        skills: ['TypeScript', 'Go'],
        links: ['https://github.com/ada'],
      },
    })
    expect(create(form)).not.toHaveProperty('tool')
    expect(create({ ...form, rate: '', price: '500' })).toMatchObject({ price: '500', expert: { rate: '0' } })
  })

  it('sends the same fields on a change, whole, and no kind', () => {
    const { kind, ...rest } = create(form)
    expect(kind).toBe('expert')
    expect(change(form)).toEqual(rest)
  })

  it('fills a person’s own listing as it stands, the chip and the note apart', () => {
    const own: Listing = {
      id: 'lst_1',
      publisherOrg: 'acme',
      kind: 'expert',
      tool: '',
      ref: '',
      title: 'Ada',
      description: 'About',
      category: '',
      price: '0',
      currency: 'USD',
      recipient: 'wal_acme',
      public: true,
      expert: { ...expert, availability: 'Weekends · after 6', skills: ['Go'], links: ['https://ada.dev'], self: true },
      createdAt: 1,
      updatedAt: 1,
    }
    expect(fill(own)).toEqual({
      title: 'Ada',
      description: 'About',
      rate: '150',
      price: '',
      fee: 'rate',
      areas: ['base', 'cloud'],
      languages: ['en', 'es'],
      skills: ['Go'],
      links: ['https://ada.dev'],
      timezone: 'America/Los_Angeles',
      hours: 'weekends',
      note: 'after 6',
      recipient: 'wal_acme',
    })
    expect(fill({ ...own, price: '500', expert: { ...own.expert!, rate: '0' } })).toMatchObject({ rate: '', price: '500', fee: 'price' })
    expect(fill({ ...own, price: '500' })).toMatchObject({ rate: '150', price: '500', fee: 'rate' })
    expect(fill({ ...own, expert: { ...own.expert!, skills: undefined, links: undefined } })).toMatchObject({ skills: [], links: [] })
  })

  it('states availability as the chip and the note, and reads it back', () => {
    expect(availability('part-time', ' Weekdays ')).toBe('Part-time · Weekdays')
    expect(availability('full-time', '')).toBe('Full-time')
    expect(availability('', 'Mornings')).toBe('Mornings')
    expect(availability('', ' ')).toBe('')
    expect(hoursOf('Weekends · after 6')).toEqual({ hours: 'weekends', note: 'after 6' })
    expect(hoursOf('part-time')).toEqual({ hours: 'part-time', note: '' })
    expect(hoursOf('Weekdays 9-17 PT')).toEqual({ hours: '', note: 'Weekdays 9-17 PT' })
    expect(hoursOf('Part-timer')).toEqual({ hours: '', note: 'Part-timer' })
  })

  it('takes a link that is https with a host, no login, and short', () => {
    expect(link('https://github.com/ada')).toBe(true)
    expect(link('http://github.com/ada')).toBe(false)
    expect(link('https://ada:pw@github.com')).toBe(false)
    expect(link('github.com/ada')).toBe(false)
    expect(link(`https://example.com/${'x'.repeat(200)}`)).toBe(false)
  })

  it('starts a short card from what is known, and the same card empty from nothing', () => {
    const blank = start({ timezone: 'Europe/Paris', languages: [] })
    expect(blank).toEqual({
      title: '',
      description: '',
      rate: '',
      price: '',
      fee: 'rate',
      areas: [],
      languages: ['en'],
      skills: [],
      links: [],
      timezone: 'Europe/Paris',
      hours: '',
      note: '',
      recipient: '',
    })
    const known = start({
      timezone: 'Europe/Paris',
      languages: ['es', 'en'],
      imported: { name: 'Ada', bio: 'Builds', skills: ['Go'], areas: ['cloud', 'base'], links: ['https://github.com/ada'], timezone: 'America/New_York' },
    })
    expect(known).toMatchObject({ title: 'Ada', description: 'Builds', areas: ['base', 'cloud'], languages: ['es', 'en'], skills: ['Go'], links: ['https://github.com/ada'], timezone: 'America/New_York' })
    expect(start({ timezone: 'Europe/Paris', languages: [], imported: { name: '', bio: '', skills: [], areas: [], links: [], timezone: '' } }).timezone).toBe('Europe/Paris')
  })

  it('shows what a fresh read would change, and never empties what the person wrote', () => {
    const held = { ...form, hours: 'part-time' as const, skills: ['Go'], links: ['https://github.com/ada'], areas: ['base'] }
    const same = { name: 'Ada Lovelace ', bio: '', skills: [], areas: ['base'], links: [], timezone: '' }
    expect(refresh(held, { ...same, name: ' Ada Lovelace ' }).changes).toEqual([])
    const out = refresh(held, { name: 'Ada L.', bio: 'New bio', skills: ['Rust', 'Go'], areas: ['cloud'], links: ['https://ada.dev'], timezone: 'Europe/Paris' })
    expect(out.changes.map((c) => c.field)).toEqual(['title', 'description', 'skills', 'links', 'areas'])
    expect(out.changes.find((c) => c.field === 'areas')).toMatchObject({ before: 'Build with Base', after: 'Build with Base, Cloud' })
    expect(out.next).toMatchObject({ title: 'Ada L.', description: 'New bio', skills: ['Rust', 'Go'], links: ['https://ada.dev'], areas: ['base', 'cloud'], timezone: 'America/Los_Angeles' })
  })

  it('lists the products an expert is scored in', () => {
    expect(PRODUCTS.map((p) => p.slug)).toEqual(['dev', 'bot', 'team', 'base', 'commerce', 'cloud', 'agents', 'kai', 'enso', 'zen', 'creative'])
    expect(productLabel('creative')).toBe('Creative AI')
    expect(productLabel('unheard-of')).toBe('unheard-of')
    expect(isProduct('kai')).toBe(true)
    expect(isProduct('web3')).toBe(false)
  })

  it('finds the listing the platform marks as the caller’s own, never a colleague’s', () => {
    const own = (id: string, self?: boolean, kind: Listing['kind'] = 'expert'): Listing => ({ id, kind, expert: { ...expert, ...(self ? { self } : {}) } }) as Listing
    const rows = [own('lst_0'), own('lst_1', true), own('lst_2', true, 'agent'), own('lst_3', true)]
    expect(mine(rows)?.id).toBe('lst_1')
    expect(mine([own('lst_0'), own('lst_2', true, 'agent')])).toBeNull()
    expect(mine([{ id: 'lst_4', kind: 'expert' } as Listing])).toBeNull()
    expect(mine([])).toBeNull()
  })
})

describe('the directory in the address', () => {
  it('reads what the address asks and drops what this list does not know', () => {
    const p = new URLSearchParams('q=ada&area=base&sort=level&dir=asc&language=es&verified=true&minLevel=2&badge=zen-pioneer&tokenTier=1b&rateMin=50&rateMax=200.5&product=kai')
    expect(shelf(p)).toEqual({ q: 'ada', area: 'base', sort: '', dir: 'asc', language: 'es', verified: true, minLevel: 2, badge: 'zen-pioneer', tokenTier: '1b', rateMin: '50', rateMax: '200.5', product: 'kai' })
    const junk = new URLSearchParams('area=web3&sort=luck&dir=sideways&language=xx&verified=yes&minLevel=9&badge=x&tokenTier=2m&rateMin=lots&rateMax=-1&product=web3')
    expect(shelf(junk)).toEqual({ q: '', area: '', sort: '', dir: 'desc', language: '', verified: false, minLevel: 0, badge: '', tokenTier: '', rateMin: '', rateMax: '', product: '' })
    // A product is the order: an address that names a sort too is read as the product.
    expect(shelf(new URLSearchParams('sort=level&product=base'))).toMatchObject({ sort: '', product: 'base' })
    expect(shelf(new URLSearchParams())).toEqual({ q: '', area: '', sort: '', dir: 'desc', language: '', verified: false, minLevel: 0, badge: '', tokenTier: '', rateMin: '', rateMax: '', product: '' })
  })

  it('asks the shop only for what narrows or orders, and the direction only of an order', () => {
    expect(asked(shelf(new URLSearchParams()), 200, 0)).toMatchObject({ kind: 'expert', q: '', sort: '', dir: undefined, verified: false, minLevel: undefined, limit: 200, offset: 0 })
    expect(asked(shelf(new URLSearchParams('sort=tokens&dir=asc&minLevel=3&verified=true&tokenTier=1m')), 200, 200)).toMatchObject({ sort: 'tokens', dir: 'asc', minLevel: 3, verified: true, tokenTier: '1m', offset: 200 })
    expect(asked(shelf(new URLSearchParams('product=base')), 200, 0)).toMatchObject({ product: 'base', dir: 'desc' })
  })

  it('sets one thing in the address and clears it when it is empty, so a view can be passed along', () => {
    const p = new URLSearchParams('area=base')
    expect(keep(p, 'sort', 'level').toString()).toBe('area=base&sort=level')
    expect(keep(p, 'area', '').toString()).toBe('')
    expect(keep(p, 'verified', true).toString()).toBe('area=base&verified=true')
    expect(keep(new URLSearchParams('verified=true'), 'verified', false).toString()).toBe('')
    expect(keep(new URLSearchParams('minLevel=2'), 'minLevel', 0).toString()).toBe('')
    expect(keep(new URLSearchParams('dir=asc'), 'dir', 'desc').toString()).toBe('')
    expect(keep(new URLSearchParams(), 'dir', 'asc').toString()).toBe('dir=asc')
    expect(keep(new URLSearchParams('sort=level&area=base'), 'product', 'kai').toString()).toBe('area=base&product=kai')
    expect(keep(new URLSearchParams('product=kai'), 'sort', 'rate').toString()).toBe('sort=rate')
    expect(keep(new URLSearchParams('sort=rate'), 'product', '').toString()).toBe('sort=rate')
    expect(p.toString()).toBe('area=base')
  })

  it('offers every order the platform has, and the token tiers lowest first', () => {
    expect(SORTS.map((o) => o.slug)).toEqual(['newest', 'tokens', 'level', 'points', 'rating', 'jobs', 'rate'])
    expect(TIERS.map((t) => t.label)).toEqual(['100K+', '1M+', '5M+', '10M+', '100M+', '1B+', '10B+', '100B+', '1T+'])
  })
})
