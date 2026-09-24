// A seller's listings, and the form that creates or edits one. A listing offers
// something the org already has — an agent, an app, a skill, an MCP server — so
// the form picks it from the org's own inventory, or authors a skill / registers
// a server first.

import { useEffect, useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'
import { Link, useNavigate, useParams } from 'react-router'

import { LABEL } from '~/lib/catalog'
import { notServed } from '~/lib/http'
import {
  agents,
  apps,
  authoredSkills,
  authorSkill,
  connectMcp,
  KINDS,
  mcpServers,
  ownListings,
  publish,
  unpublish,
  updateListing,
  wallets,
  type Kind,
  type Listing,
} from '~/lib/market'
import { free, usd, valid } from '~/lib/money'
import { useRead, useRun, type Read } from '~/lib/read'
import { Gate } from '~/gate'
import { SellNav } from '~/pages/setup'
import { useSession } from '~/session'
import { Act, Choice, Failed, Field, Fields, Go, List, Mark, Nothing, Page, Panel, Pending, Refusal, Row, Section, Tick, Words } from '~/ui'

export function Listings() {
  return (
    <Gate why="Listings are published by your organization.">
      <Mine />
    </Gate>
  )
}

function Mine() {
  const session = useSession()
  const read = useRead(() => ownListings().then((r) => r.listings), [session.org])
  const { busy, failed, run } = useRun()
  return (
    <Page eyebrow="Sell" title="Your listings" says="What your organization offers. Public listings appear in the catalog; private ones only to you." beside={<Go to="/sell/listings/new" loud>New listing</Go>}>
      <SellNav />
      <Refusal says={failed} />
      <List read={read} what="your listings" none="No listings yet. Create one to start selling.">
        {(rows) =>
          rows.map((l) => (
            <Row key={l.id}>
              <YStack flex={1} minW={200} gap="$1">
                <Link to={`/sell/listings/${encodeURIComponent(l.id)}`} style={{ textDecoration: 'none' }}>
                  <Text fontSize="$3" color="$ink" numberOfLines={1}>
                    {l.title}
                  </Text>
                </Link>
                <Text fontSize="$1" color="$quiet">
                  {l.kind ? LABEL[l.kind].one : 'Tool'} · {l.tool}
                </Text>
              </YStack>
              <Text fontSize="$2" color="$ink">
                {free(l.price) ? 'Free' : usd(l.price, l.currency)}
              </Text>
              <Mark tone={l.public ? 'up' : 'quiet'} says={l.public ? 'Public' : 'Private'} />
              <Act disabled={busy} onPress={() => void run(async () => (await unpublish(l.id), read.again()))} label={`Unpublish ${l.title}`}>
                Unpublish
              </Act>
            </Row>
          ))
        }
      </List>
    </Page>
  )
}

export function ListingForm() {
  return (
    <Gate why="Listings are published by your organization.">
      <Form />
    </Gate>
  )
}

/** What the org already has of `kind`, as (tool name, label) pairs. */
async function inventory(kind: Kind, org: string | null): Promise<{ tool: string; label: string }[]> {
  if (kind === 'agent') return (await agents()).agents.map((a) => ({ tool: a.name, label: a.name }))
  if (kind === 'skill') return (await authoredSkills()).skills.map((s) => ({ tool: s.name, label: s.name }))
  if (kind === 'mcp') return (await mcpServers()).servers.map((s) => ({ tool: s.name, label: `${s.name} · ${s.url}` }))
  if (!org) return []
  return (await apps({ org, limit: 200 })).data.map((e) => ({ tool: e.name, label: e.title || e.name }))
}

function Form() {
  const { id } = useParams()
  const editing = Boolean(id)
  const go = useNavigate()
  const session = useSession()
  const existing = useRead(editing ? () => ownListings().then((r) => r.listings.find((l) => l.id === id) ?? null) : null, [id, session.org])

  const [kind, setKind] = useState<Kind>('agent')
  const [tool, setTool] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('0')
  const [recipient, setRecipient] = useState('')
  const [open, setOpen] = useState(true)
  const [docs, setDocs] = useState('')
  const [made, setMade] = useState<Listing | null>(null)

  useEffect(() => {
    const l = existing.it
    if (!l) return
    if (l.kind) setKind(l.kind)
    setTool(l.tool)
    setTitle(l.title)
    setDescription(l.description)
    setCategory(l.category)
    setPrice(l.price || '0')
    setRecipient(l.recipient)
    setOpen(l.public)
    setDocs(l.docs ?? '')
  }, [existing.it])

  const have = useRead(editing ? null : () => inventory(kind, session.org), [kind, session.org, editing])
  const mine = useRead(() => wallets(), [session.org])
  const { busy, failed, status, run } = useRun()

  const priced = valid(price) && !free(price)
  const payTo = recipient || mine.it?.wallets[0]?.id || ''
  const ready = tool.trim() && title.trim() && valid(price) && (!priced || payTo)

  const save = () =>
    void run(async () => {
      const fields = {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        price: price.trim(),
        currency: 'USD',
        recipient: priced ? payTo : undefined,
        public: open,
        docs: docs.trim() || undefined,
      }
      const saved = editing && id ? await updateListing(id, fields) : await publish({ ...fields, tool: tool.trim(), kind })
      setMade(saved)
    })

  if (editing && existing.failed) return <Page title="Edit listing"><Failed what="load this listing" why={existing.failed} /></Page>
  if (editing && !existing.it) return existing.loading ? <Nothing says="Loading…" /> : <Page title="Edit listing"><Failed what="find this listing" why="Your organization has no listing with this id." /></Page>

  if (made) {
    return (
      <Page eyebrow="Sell" title={editing ? 'Listing saved' : 'Listing published'} says={made.public ? 'It is in the catalog now.' : 'It is private: only your organization sees it.'}>
        <Panel>
          <Text fontSize="$4" color="$ink">
            {made.title}
          </Text>
          <Text fontSize="$2" color="$soft">
            {free(made.price) ? 'Free' : `${usd(made.price)} per ${kind === 'agent' ? 'job' : 'call'}`} · {made.tool}
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            <Go to={`/l/${encodeURIComponent(made.id)}`} loud>
              View listing
            </Go>
            <Act onPress={() => go('/sell/listings')}>All listings</Act>
          </XStack>
        </Panel>
      </Page>
    )
  }

  return (
    <Page eyebrow="Sell" title={editing ? 'Edit listing' : 'New listing'} says="A listing offers one thing your organization runs, free or priced.">
      <SellNav />
      <Section title="What you are selling">
        <Panel gap="$4">
          <XStack gap="$2" flexWrap="wrap" role="group" aria-label="Kind">
            {KINDS.map((k) => (
              <Act key={k} on={kind === k} disabled={editing} onPress={() => (setKind(k), setTool(''))}>
                {LABEL[k].one}
              </Act>
            ))}
          </XStack>
          {editing ? (
            <Text fontSize="$2" color="$soft">
              {LABEL[kind].one} · {tool}
            </Text>
          ) : (
            <Source kind={kind} have={have} tool={tool} setTool={setTool} onMade={have.again} />
          )}
        </Panel>
      </Section>

      <Section title="The listing">
        <Panel gap="$4">
          <Fields>
            <Field label="Title" value={title} set={setTitle} name="title" />
            <Field label="Category" value={category} set={setCategory} hint="e.g. research, devops" name="category" />
          </Fields>
          <Words label="Description" value={description} set={setDescription} hint="What it does, what it needs, what it returns." />
          <Fields>
            <Field
              label={kind === 'agent' ? 'Price per job (USD)' : 'Price per call (USD)'}
              value={price}
              set={setPrice}
              name="price"
              help="0 is free. Up to 18 decimal places — per-call prices are often fractions of a cent."
            />
            {priced ? (
              mine.it?.wallets.length ? (
                <Choice
                  label="Paid into"
                  value={payTo}
                  set={setRecipient}
                  of={mine.it.wallets.map((w) => ({ value: w.id, label: `${w.name} · ${w.chain}` }))}
                />
              ) : (
                <YStack gap="$2" flex={1} minW={200}>
                  <Text fontSize="$2" color="$soft">
                    Paid into
                  </Text>
                  <Text fontSize="$2" color="$quiet">
                    A priced listing needs a payout wallet.
                  </Text>
                  <Go to="/sell">Create one</Go>
                </YStack>
              )
            ) : null}
          </Fields>
          <Field label="Documentation link (optional)" value={docs} set={setDocs} hint="https://docs.…" name="docs" />
          <Tick label="Public — list it in the catalog" checked={open} set={setOpen} />
          <XStack>
            <Act loud disabled={!ready || busy} onPress={save}>
              {editing ? 'Save listing' : 'Publish listing'}
            </Act>
          </XStack>
          {failed && editing && notServed(status) ? (
            <Pending what="Editing is not live yet" says="api.hanzo.ai does not answer PATCH /v1/marketplace/listings/{id} yet. Unpublish and publish again to change a listing today." />
          ) : (
            <Refusal says={failed} />
          )}
        </Panel>
      </Section>
    </Page>
  )
}

/** Pick what the listing offers from the org's inventory, or make it here. */
function Source({
  kind,
  have,
  tool,
  setTool,
  onMade,
}: {
  kind: Kind
  have: Read<{ tool: string; label: string }[]>
  tool: string
  setTool: (t: string) => void
  onMade: () => void
}) {
  const { busy, failed, run } = useRun()
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const list = have.it ?? []

  return (
    <YStack gap="$3">
      {have.failed ? (
        <Failed what={`load your ${LABEL[kind].many.toLowerCase()}`} why={have.failed} />
      ) : !have.it ? (
        <Text fontSize="$2" color="$quiet">
          Loading…
        </Text>
      ) : list.length ? (
        <Choice
          label={`Which ${LABEL[kind].one.toLowerCase()}`}
          value={tool || ''}
          set={setTool}
          of={[{ value: '', label: 'Choose one' }, ...list.map((i) => ({ value: i.tool, label: i.label }))]}
        />
      ) : (
        <Text fontSize="$2" color="$quiet">
          Your organization has no {LABEL[kind].many.toLowerCase()} yet.
        </Text>
      )}

      {kind === 'skill' ? (
        <YStack gap="$3" pt="$2">
          <Text fontSize="$2" color="$soft">
            Or write a new skill
          </Text>
          <Field label="Skill name" value={name} set={setName} hint="lowercase-with-dashes" name="skill-name" />
          <Words label="SKILL.md" value={body} set={setBody} rows={6} hint="# What this skill does…" />
          <XStack>
            <Act
              disabled={busy || !/^[a-z0-9_-]+$/.test(name) || !body.trim()}
              onPress={() => void run(async () => (await authorSkill({ name, content: body }), setTool(name), onMade()))}
            >
              Save skill
            </Act>
          </XStack>
        </YStack>
      ) : null}

      {kind === 'mcp' ? (
        <YStack gap="$3" pt="$2">
          <Text fontSize="$2" color="$soft">
            Or register a server
          </Text>
          <Fields>
            <Field label="Server name" value={name} set={setName} name="server-name" />
            <Field label="URL" value={url} set={setUrl} hint="https://…/mcp" name="server-url" />
          </Fields>
          <XStack>
            <Act
              disabled={busy || !name.trim() || !url.startsWith('https://')}
              onPress={() => void run(async () => (await connectMcp({ name: name.trim(), url: url.trim() }), setTool(name.trim()), onMade()))}
            >
              Register server
            </Act>
          </XStack>
        </YStack>
      ) : null}

      {kind === 'agent' && have.it && !list.length ? <Go to="https://console.hanzo.ai/agents">Create an agent in the console</Go> : null}
      <Refusal says={failed} />
    </YStack>
  )
}
