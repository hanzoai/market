import {
  AREAS,
  areaLabel,
  change,
  check,
  create,
  every,
  facts,
  fees,
  fill,
  FREELANCE,
  isArea,
  language,
  LANGUAGES,
  mine,
  opening,
  PAGE,
  profile,
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
  availability: ' Weekdays 9-17 PT ',
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
    expect(profile(row('a'))).toEqual({ ...expert, price: '0', rating: 4.8, reviews: 23 })
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
    [{ availability: 'x'.repeat(513) }, 'Availability is at most 512 characters.'],
    [{ rate: 'a lot' }, 'A rate or a price is a dollar amount to the cent.'],
    [{ price: '12.345' }, 'A rate or a price is a dollar amount to the cent.'],
    [{ rate: '', price: '' }, 'Name an hourly rate or a fixed price.'],
    [{ rate: '0', price: '0.00' }, 'Name an hourly rate or a fixed price.'],
    [{ recipient: '' }, 'A paid listing needs a payout wallet.'],
  ] as [Partial<Form>, string][])('says why %j cannot be saved', (over, why) => {
    expect(check({ ...form, ...over })).toBe(why)
  })

  it('accepts the limits exactly', () => {
    expect(check({ ...form, title: 'x'.repeat(200), description: 'x'.repeat(4096), availability: 'x'.repeat(512), languages: ['en', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'ru'] })).toBeNull()
  })

  it('sends exactly the create body: no tool, areas in list order, none as "0", the payout wallet', () => {
    expect(create(form)).toEqual({
      kind: 'expert',
      title: 'Ada Lovelace',
      description: 'Builds on Base.',
      price: '0',
      recipient: 'wal_acme',
      public: true,
      expert: { rate: '150', areas: ['base', 'cloud'], languages: ['en', 'es'], timezone: 'America/Los_Angeles', availability: 'Weekdays 9-17 PT' },
    })
    expect(create(form)).not.toHaveProperty('tool')
    expect(create({ ...form, rate: '', price: '500' })).toMatchObject({ price: '500', expert: { rate: '0' } })
  })

  it('sends the same fields on a change, whole, and no kind', () => {
    const { kind, ...rest } = create(form)
    expect(kind).toBe('expert')
    expect(change(form)).toEqual(rest)
  })

  it('fills a blank form in the reader’s zone, and a person’s own listing as it stands', () => {
    expect(fill(null, 'Europe/Paris')).toEqual({ title: '', description: '', rate: '', price: '', areas: [], languages: [], timezone: 'Europe/Paris', availability: '', recipient: '' })
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
      expert: { ...expert, person: 'acme/ada' },
      createdAt: 1,
      updatedAt: 1,
    }
    expect(fill(own, 'Europe/Paris')).toEqual({
      title: 'Ada',
      description: 'About',
      rate: '150',
      price: '',
      areas: ['base', 'cloud'],
      languages: ['en', 'es'],
      timezone: 'America/Los_Angeles',
      availability: 'Weekdays 9-17 PT',
      recipient: 'wal_acme',
    })
    expect(fill({ ...own, price: '500' }, 'UTC').price).toBe('500')
  })

  it('finds the listing that is this person’s by the subject, the name or the email', () => {
    const own = (person: string | undefined, id = 'lst_1', kind: Listing['kind'] = 'expert'): Listing =>
      ({ id, kind, expert: person === undefined ? { ...expert } : { ...expert, person } }) as Listing
    const rows = [own('acme/grace', 'lst_0'), own('acme/ada', 'lst_1'), own('ada@acme.test', 'lst_2'), own('ada', 'lst_3'), own(undefined, 'lst_4'), own('acme/ada', 'lst_5', 'agent')]
    expect(mine(rows, 'acme/ada', null)?.id).toBe('lst_1')
    expect(mine(rows.slice(2), 'acme/ada', 'ada@acme.test')?.id).toBe('lst_2')
    expect(mine(rows.slice(3), 'acme/ada', null)?.id).toBe('lst_3')
    expect(mine(rows, 'acme/lin', null)).toBeNull()
    expect(mine(rows, undefined, null)).toBeNull()
    expect(mine([], 'acme/ada', 'ada@acme.test')).toBeNull()
  })
})
