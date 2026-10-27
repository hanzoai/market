import { expect, test, type Page } from '@playwright/test'

import { mock, world } from './mock'

// A recording WebMCP: what the storefront registers lands on window.__tools, so
// a test can read each tool's declaration and run it in the page.
async function record(page: Page, where: 'document' | 'navigator') {
  await page.addInitScript((at) => {
    const tools: unknown[] = []
    Object.defineProperty(window, '__tools', { value: tools })
    const mc = { registerTool: (t: unknown) => void tools.push(t) }
    Object.defineProperty(at === 'document' ? document : navigator, 'modelContext', { value: mc, configurable: true })
  }, where)
}

interface Declared {
  name: string
  annotations: { readOnlyHint: boolean }
  inputSchema: { required: string[] }
}

const declared = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __tools: Declared[] }).__tools.map((t) => ({ name: t.name, annotations: t.annotations, inputSchema: { required: t.inputSchema.required } })),
  )

const run = (page: Page, name: string, input: Record<string, unknown>) =>
  page.evaluate(
    async ([n, i]) => {
      const tool = (window as unknown as { __tools: { name: string; execute: (x: unknown) => Promise<unknown> }[] }).__tools.find((t) => t.name === n)
      try {
        return { ok: await tool!.execute(i) }
      } catch (e) {
        return { failed: (e as Error).message }
      }
    },
    [name, input] as const,
  )

test('registers two read-only tools on document.modelContext, and nothing that buys or installs', async ({ page }) => {
  await record(page, 'document')
  await mock(page, world())
  await page.goto('/')
  await expect.poll(() => declared(page)).toEqual([
    { name: 'search_market', annotations: { readOnlyHint: true }, inputSchema: { required: ['query'] } },
    { name: 'get_listing', annotations: { readOnlyHint: true }, inputSchema: { required: ['id'] } },
  ])
})

test('falls back to the earlier navigator.modelContext', async ({ page }) => {
  await record(page, 'navigator')
  await mock(page, world())
  await page.goto('/agents')
  await expect.poll(async () => (await declared(page)).map((t) => t.name)).toEqual(['search_market', 'get_listing'])
})

test('a browser without WebMCP loads the page with no error', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await mock(page, world())
  await page.goto('/')
  await expect(page.getByRole('searchbox', { name: 'Search the marketplace' })).toBeVisible()
  expect(errors).toEqual([])
})

test('search_market finds listings across shelves, with a price only where the shop sets one', async ({ page }) => {
  await record(page, 'document')
  const w = world()
  await mock(page, w)
  await page.goto('/')
  await expect.poll(async () => (await declared(page)).length).toBe(2)

  const found = (await run(page, 'search_market', { query: 'research' })) as { ok: { hits: { id: string; price?: string; shop: boolean; url: string }[] } }
  const hits = found.ok.hits
  expect(hits.find((h) => h.id === 'listing:lst_research')).toMatchObject({ price: '$250.00 per job', shop: true, url: 'https://hanzo.market/l/lst_research' })
  const directory = hits.find((h) => h.id === 'listing:lst_agent_research')
  expect(directory).toMatchObject({ shop: false })
  expect(directory).not.toHaveProperty('price')

  const personas = (await run(page, 'search_market', { query: 'lovelace', kind: 'persona' })) as { ok: { kind: string; hits: { id: string; kind: string }[] } }
  expect(personas.ok.kind).toBe('persona')
  expect(personas.ok.hits.map((h) => h.id)).toContain('persona:ada')
  expect(personas.ok.hits.every((h) => h.kind === 'persona')).toBe(true)

  expect(await run(page, 'search_market', { query: ' ' })).toEqual({ failed: 'query is empty' })
  expect(await run(page, 'search_market', { query: 'x', kind: 'nft' })).toEqual({ failed: expect.stringMatching(/^kind is one of agent, persona/) })
  // Searching is reads only.
  expect(w.calls.filter((c) => !c.startsWith('GET '))).toEqual([])
})

test('get_listing reads one listing whole: the command that gets it, its page and its twin', async ({ page }) => {
  await record(page, 'document')
  await mock(page, world())
  await page.goto('/')
  await expect.poll(async () => (await declared(page)).length).toBe(2)

  const one = (await run(page, 'get_listing', { id: 'listing:lst_research' })) as { ok: Record<string, unknown> }
  expect(one.ok).toMatchObject({
    id: 'listing:lst_research',
    kind: 'agent',
    title: 'Deep Research Agent',
    price: '$250.00 per job',
    shop: true,
    cli: 'hanzo marketplace jobs create --listing lst_research --brief <brief> --amount <usd>',
    url: 'https://hanzo.market/l/lst_research',
    markdown: 'https://hanzo.market/l/lst_research.md',
  })
  expect(JSON.parse(String(one.ok.mcp))).toMatchObject({ name: 'marketplace', arguments: { op: 'post_marketplace_jobs' } })

  const ada = (await run(page, 'get_listing', { id: 'persona:ada' })) as { ok: { body: string; shop: boolean; reputation: unknown } }
  expect(ada.ok.body).toContain('name: Ada')
  expect(ada.ok).toMatchObject({ shop: false, reputation: null })

  const directory = (await run(page, 'get_listing', { id: 'listing:lst_tool_hanzo_search' })) as { ok: Record<string, unknown> }
  expect(directory.ok).toMatchObject({ shop: false })
  expect(directory.ok).not.toHaveProperty('price')

  expect(await run(page, 'get_listing', { id: 'nothing' })).toEqual({ failed: expect.stringMatching(/^no listing "nothing"/) })
})
