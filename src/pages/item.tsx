// A listing page: what it is, who offers it, its reputation, how to get it, and
// the same action as a docs link, a CLI line and an MCP call.

import { useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'
import { Star } from 'lucide-react'
import { useNavigate, useParams } from 'react-router'

import { LABEL } from '~/lib/catalog'
import { appDetail, listingDetail, mcpCall, mcpDetail, personaDetail, skillDetail, templateDetail, type Detail } from '~/lib/detail'
import { api } from '~/lib/api'
import { needsSession, notServed } from '~/lib/http'
import { apps, connectMcp, install, mcpListing, shopListing, skillDoc, skills, type Reputation } from '~/lib/market'
import { findDefaultListing, findDefaultMcp } from '~/lib/registry'
import { useRead, useRun, type Read } from '~/lib/read'
import { useSession } from '~/session'
import { Act, Code, Column, Count, Eyebrow, Failed, Go, Mark, Nothing, Panel, Pending, Refusal, Section } from '~/ui'

// One read per kind of item, shared by the pages and the WebMCP tools.

export const loadListing = (id: string) =>
  shopListing(id)
    .catch((err) => {
      const fallback = findDefaultListing(id)
      if (fallback) return fallback
      throw err
    })
    .then(listingDetail)

export const loadApp = (org: string, name: string) =>
  apps({ q: name, org, limit: 50 }).then((r) => {
    const hit = r.data.find((e) => e.org === org && e.name === name)
    if (!hit) throw new Error(`No app named ${org}/${name} in the catalog.`)
    return appDetail(hit)
  })

export const loadSkill = (name: string) =>
  Promise.all([skills(), skillDoc(name).catch(() => '')]).then(([index, doc]) => {
    const hit = index.skills.find((s) => s.name === name)
    if (!hit) throw new Error(`No skill named ${name}.`)
    return skillDetail(hit, doc, api())
  })

export const loadTemplate = async (slug: string) => templateDetail(slug)

/** A persona's definition is published beside its page, at /personas/<slug>/PERSONA.md, for the 67 that have one. */
export const loadPersona = (slug: string) =>
  fetch(`/personas/${encodeURIComponent(slug)}/PERSONA.md`)
    .then((r) => (r.ok ? r.text() : ''))
    .catch(() => '')
    .then((doc) => personaDetail(slug, doc))

export const loadMcp = (id: string) =>
  mcpListing(id)
    .catch((err) => {
      const fallback = findDefaultMcp(id)
      if (fallback) return fallback
      throw err
    })
    .then(mcpDetail)

export function ListingPage() {
  const { id = '' } = useParams()
  const read = useRead(() => loadListing(id), [id])
  return <View read={read} />
}

export function AppPage() {
  const { org = '', name = '' } = useParams()
  const read = useRead(() => loadApp(org, name), [org, name])
  return <View read={read} />
}

export function SkillPage() {
  const { name = '' } = useParams()
  const read = useRead(() => loadSkill(name), [name])
  return <View read={read} />
}

export function TemplatePage() {
  const { slug = '' } = useParams()
  const read = useRead(() => loadTemplate(slug), [slug])
  return <View read={read} />
}

export function PersonaPage() {
  const { slug = '' } = useParams()
  const read = useRead(() => loadPersona(slug), [slug])
  return <View read={read} />
}

export function McpPage() {
  const { id = '' } = useParams()
  const session = useSession()
  const fallback = findDefaultMcp(id)
  const read = useRead(
    session.loading
      ? null
      : () => {
          if (!session.signedIn && fallback) return Promise.resolve(mcpDetail(fallback))
          return loadMcp(id)
        },
    [id, session.loading, session.signedIn],
  )
  if (!session.loading && !fallback && (!session.signedIn || needsSession(read.status))) {
    return (
      <Column gap="$4" py="$8">
        <Eyebrow>MCP server</Eyebrow>
        <Text render="h1" fontSize="$8" fontWeight="600" color="$ink">
          {id}
        </Text>
        <Text fontSize="$3" color="$soft">
          The MCP registry answers signed-in organizations. Sign in to see this server and connect it.
        </Text>
        <XStack>
          <Act loud onPress={session.signIn}>
            Try Hanzo
          </Act>
        </XStack>
      </Column>
    )
  }
  return <View read={read} />
}

function View({ read }: { read: Read<Detail> }) {
  if (read.failed) {
    return (
      <Column py="$8">
        <Failed what="open this listing" why={read.failed} />
      </Column>
    )
  }
  if (!read.it) return <Nothing says="Loading…" />
  return <Shown d={read.it} />
}

function Shown({ d }: { d: Detail }) {
  const call = mcpCall(d)
  return (
    <Column gap="$6" py="$8">
      <XStack gap="$6" flexWrap="wrap" items="flex-start">
        <YStack gap="$3" flex={2} minW={300}>
          <Eyebrow>{LABEL[d.item.kind].one}</Eyebrow>
          <Text render="h1" fontSize="$9" fontWeight="600" color="$ink">
            {d.item.title}
          </Text>
          <Text fontSize="$3" color="$soft">
            by {d.item.by}
          </Text>
          <Text fontSize="$3" color="$ink" whiteSpace="pre-wrap" data-body="">
            {d.body || 'No description.'}
          </Text>
        </YStack>
        <YStack gap="$4" flex={1} minW={280}>
          <Panel>
            <Text fontSize="$6" fontWeight="600" color="$ink">
              {d.item.price ?? 'Free'}
            </Text>
            <Obtain d={d} />
          </Panel>
          <Panel gap="$2">
            {d.facts.map(([k, v]) => (
              <XStack key={k} justify="space-between" gap="$3">
                <Text fontSize="$2" color="$quiet">
                  {k}
                </Text>
                <Text fontSize="$2" color="$ink" numberOfLines={1}>
                  {v}
                </Text>
              </XStack>
            ))}
          </Panel>
        </YStack>
      </XStack>

      <Section title="Reputation">
        <Rep d={d} />
      </Section>

      <Section title="Use it" says="The same action from the docs, a terminal, or an agent.">
        <XStack gap="$2" flexWrap="wrap">
          {d.links.map((l) => (
            <Go key={l.href} to={l.href}>
              {l.label}
            </Go>
          ))}
        </XStack>
        {d.cli ? <Code label="CLI" line={d.cli} /> : null}
        {call ? <Code label="MCP tool (hanzo-mcp)" line={call} /> : null}
      </Section>

      <Section
        title="Contribute & Earn (OSS + x402)"
        says="Every Hanzo agent, persona, skill, MCP server, and template is open-source. Fork or improve it on GitHub, or publish your own on Hanzo Market and get paid automatically over x402 whenever people or agents use your work."
      >
        <XStack gap="$2" flexWrap="wrap">
          <Go to="/sell">Publish & earn on Hanzo Market</Go>
          <Go to="https://github.com/hanzoai">Contribute on GitHub</Go>
          <Go to="https://docs.hanzo.ai/docs/marketplace">Creator payout docs</Go>
        </XStack>
      </Section>
    </Column>
  )
}

function Rep({ d }: { d: Detail }) {
  const of: Reputation | null = d.reputation
  const hired = d.get.how === 'checkout' && d.get.hire
  if (!of) {
    return (
      <Text fontSize="$2" color="$quiet">
        {d.item.kind === 'skill' ? 'Published by Hanzo; no marketplace reviews.' : 'No reputation yet.'}
      </Text>
    )
  }
  return (
    <XStack gap="$3" flexWrap="wrap" data-reputation="">
      <Count
        of={
          of.rating === null ? (
            '—'
          ) : (
            <XStack items="center" gap="$2">
              <Star size={18} aria-hidden />
              <Text fontSize="$7" fontWeight="600" color="$ink">
                {of.rating.toFixed(1)}
              </Text>
            </XStack>
          )
        }
        says={`${of.reviews} review${of.reviews === 1 ? '' : 's'}`}
      />
      {hired ? null : <Count of={of.installs} says={d.get.how === 'open' ? 'Stars' : 'Installs'} />}
      {hired ? <Count of={of.jobs.completed} says="Jobs completed" /> : null}
      {hired ? <Count of={of.jobs.disputed} says="Jobs disputed" /> : null}
    </XStack>
  )
}

/** The primary action for this item. */
function Obtain({ d }: { d: Detail }) {
  const session = useSession()
  const go = useNavigate()
  const { busy, failed, status, run } = useRun()
  const [done, setDone] = useState<string | null>(null)
  const get = d.get

  if (get.how === 'open') {
    return get.href ? (
      <Go to={get.href} loud>
        Open
      </Go>
    ) : (
      <Text fontSize="$2" color="$quiet">
        No public address for this app.
      </Text>
    )
  }

  if (get.how === 'checkout') {
    return (
      <YStack gap="$2">
        <Act loud onPress={() => go(`/checkout/${encodeURIComponent(get.listing)}`)}>
          {get.hire ? 'Hire' : 'Buy'}
        </Act>
        <Text fontSize="$1" color="$quiet">
          {get.hire
            ? 'Checkout runs clearance first and tells you what, if anything, is needed.'
            : 'Installed for your organization; each call settles over x402.'}
        </Text>
      </YStack>
    )
  }

  if (!session.signedIn) {
    return (
      <YStack gap="$2">
        <Act loud onPress={session.signIn}>
          Sign in to {get.how === 'connect' ? 'connect' : 'install'}
        </Act>
        <Text fontSize="$1" color="$quiet">
          Installs are made for your organization.
        </Text>
      </YStack>
    )
  }

  if (done) return <Mark tone="up" says={done} />

  const act = () =>
    run(async () => {
      if (get.how === 'install') await install(get.tool)
      else await connectMcp({ listing: get.listing })
      setDone(get.how === 'install' ? `Installed for ${session.org ?? 'your organization'}` : `Connected to ${session.org ?? 'your organization'}`)
    })

  return (
    <YStack gap="$2">
      <Act loud disabled={busy} onPress={() => void act()}>
        {get.how === 'install' ? 'Install' : 'Connect'}
      </Act>
      {failed && notServed(status) ? (
        <Pending what="Install is not live yet" says={failed} />
      ) : (
        <Refusal says={failed} />
      )}
    </YStack>
  )
}
