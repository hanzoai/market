// Become an expert. Any signed-in member lists themself: one short card writes one
// `expert` listing, which people book through the same job as an agent. The card
// is filled from what is really known (the GitHub account IAM linked, this
// browser's zone and languages) and left empty where nothing is; every value is
// the person's to change. A person has one listing, so a member who already has it
// is shown it to edit. Payment needs the org's payout wallet, chosen the way a
// seller's listing chooses it.

import { useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'
import { useLocation, useNavigate } from 'react-router'

import { AREAS, change, check, create, fill, FREELANCE, HOURS, language, LANGUAGES, LIMITS, link, mine, start, zones, type Form } from '~/lib/expert'
import { pull, spoken, type Imported } from '~/lib/github'
import { why } from '~/lib/http'
import { connect, github, GITHUB } from '~/lib/linked'
import { ownListings, publish, updateListing, wallets, type Listing } from '~/lib/market'
import { free, valid } from '~/lib/money'
import { useRead, useRun } from '~/lib/read'
import { mine as rewards, show, type Own as Program } from '~/lib/reward'
import { Gate } from '~/gate'
import { Payout } from '~/pages/listings'
import { useSession } from '~/session'
import { Act, Add, Choice, Entry, Failed, Field, Nothing, Page, Panel, Refusal, Tick, Words } from '~/ui'

export function Join() {
  return (
    <Gate why="An expert listing belongs to your Hanzo account.">
      <Own />
    </Gate>
  )
}

/** What is known before the card is drawn. */
interface Known {
  /** The id of the linked GitHub account, when there is one. */
  account: string | null
  imported: Imported | null
  /** Why GitHub's record could not be read, said as it is. */
  unread: string | null
  /** The member's rewards profile; null where the program is not served. */
  program: Program | null
}

async function learn(own: Listing | null): Promise<Known> {
  const [account, program] = await Promise.all([github().catch(() => null), rewards().catch(() => null)])
  if (!account || own) return { account, imported: null, unread: null, program }
  try {
    return { account, imported: await pull(account), unread: null, program }
  } catch (e) {
    return { account, imported: null, unread: why(e), program }
  }
}

function Own() {
  const session = useSession()
  const rows = useRead(() => ownListings().then((r) => r.listings), [session.org])
  if (rows.failed) {
    return (
      <Page title="Become an expert">
        <Failed what="load your listings" why={rows.failed} />
      </Page>
    )
  }
  if (!rows.it) return <Nothing says="Loading…" />
  return <Prepared own={mine(rows.it)} reread={rows.again} />
}

function Prepared({ own, reread }: { own: Listing | null; reread: () => void }) {
  const known = useRead(() => learn(own), [own?.id])
  if (!known.it) return known.failed ? <Failed what="open the form" why={known.failed} /> : <Nothing says="Loading…" />
  return <Editor key={own?.id ?? 'new'} own={own} known={known.it} reread={reread} />
}

/** Toggle chips over a closed set of choices, kept in the order the set lists them. */
function Pick({ label, of, value, set, max, help }: { label: string; of: { value: string; label: string }[]; value: string[]; set: (v: string[]) => void; max?: number; help?: string }) {
  const toggle = (v: string) => {
    const on = value.includes(v)
    if (!on && max !== undefined && value.length >= max) return
    set(of.map((o) => o.value).filter((x) => (x === v ? !on : value.includes(x))))
  }
  return (
    <YStack gap="$2">
      <Text fontSize="$2" color="$soft">
        {label}
      </Text>
      <XStack gap="$2" flexWrap="wrap" role="group" aria-label={label}>
        {of.map((o) => (
          <Act key={o.value} on={value.includes(o.value)} onPress={() => toggle(o.value)}>
            {o.label}
          </Act>
        ))}
      </XStack>
      {help ? (
        <Text fontSize="$1" color="$quiet">
          {help}
        </Text>
      ) : null}
    </YStack>
  )
}

/** One of a few, as chips: pressing the chosen one again chooses none. */
function One({ label, of, value, set }: { label: string; of: { value: string; label: string }[]; value: string; set: (v: string) => void }) {
  return (
    <YStack gap="$2">
      <Text fontSize="$2" color="$soft">
        {label}
      </Text>
      <XStack gap="$2" flexWrap="wrap" role="group" aria-label={label}>
        {of.map((o) => (
          <Act key={o.value} on={value === o.value} onPress={() => set(value === o.value ? '' : o.value)}>
            {o.label}
          </Act>
        ))}
      </XStack>
    </YStack>
  )
}

/** What they hold, as chips that can be taken off, and a small field in the same row to add one. `ok` says what may be added. */
function Chips({ label, value, set, max, ok, show: say = (v) => v }: { label: string; value: string[]; set: (v: string[]) => void; max: number; ok?: (v: string) => boolean; show?: (v: string) => string }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (!v || value.includes(v) || value.length >= max || (ok && !ok(v))) return
    set([...value, v])
    setDraft('')
  }
  return (
    <YStack gap="$2">
      <Text fontSize="$2" color="$soft">
        {label}
      </Text>
      <XStack gap="$2" flexWrap="wrap" items="center" role="group" aria-label={label}>
        {value.map((v) => (
          <Act key={v} on label={`Remove ${say(v)}`} onPress={() => set(value.filter((x) => x !== v))}>
            {`${say(v)} ×`}
          </Act>
        ))}
        <Entry label={`Add ${label.toLowerCase()}`} value={draft} set={setDraft} enter={add} hint="Add" />
      </XStack>
    </YStack>
  )
}

/** The languages held as chips that can be taken off, and a small list in the same row to add another from. */
function Spoken({ value, set }: { value: string[]; set: (v: string[]) => void }) {
  const rest = [...LANGUAGES].filter((l) => !value.includes(l))
  return (
    <YStack gap="$2">
      <Text fontSize="$2" color="$soft">
        Languages
      </Text>
      <XStack gap="$2" flexWrap="wrap" items="center" role="group" aria-label="Languages">
        {value.map((l) => (
          <Act key={l} on label={`Remove ${language(l)}`} onPress={() => set(value.filter((x) => x !== l))}>
            {`${language(l)} ×`}
          </Act>
        ))}
        {value.length < LIMITS.languages && rest.length ? (
          <Add label="Add language" value="" set={(l) => l && set([...value, l])} of={[{ value: '', label: 'Add' }, ...rest.map((l) => ({ value: l, label: language(l) }))]} />
        ) : null}
      </XStack>
    </YStack>
  )
}

function Editor({ own, known, reread }: { own: Listing | null; known: Known; reread: () => void }) {
  const go = useNavigate()
  const session = useSession()
  const said = (useLocation().state as { refused?: string } | null)?.refused ?? null
  const [form, setForm] = useState<Form>(() =>
    own ? fill(own) : start({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, languages: spoken(navigator.languages), imported: known.imported }),
  )
  const [shown, setShown] = useState(() => (known.program?.handle ? known.program.public : true))
  const [joining, setJoining] = useState<string | null>(null)
  const put = (next: Partial<Form>) => setForm((f) => ({ ...f, ...next }))
  const pay = useRead(() => wallets(), [session.org])
  const { busy, failed, status, run } = useRun()

  const priced = [form.rate, form.price].some((a) => valid(a.trim()) && !free(a))
  const recipient = form.recipient || pay.it?.wallets[0]?.id || ''
  const blocked = check({ ...form, recipient })
  const fee = form.fee === 'rate' ? { label: 'Hourly rate (USD)', value: form.rate, hint: '150' } : { label: 'Fixed price (USD)', value: form.price, hint: '500' }

  const save = () =>
    void run(async () => {
      const f = { ...form, recipient }
      await show(shown, known.program, { github: known.imported?.login, name: session.name, email: session.email ?? undefined })
      const saved = own ? await updateListing(own.id, change(f)) : await publish(create(f))
      await go(`/experts/${encodeURIComponent(saved.id)}`)
    })

  const connecting = () => {
    setJoining(null)
    void connect(GITHUB, window.location.pathname).catch((e: unknown) => setJoining(why(e)))
  }

  return (
    <Page eyebrow="Experts" title={own ? 'Your expert listing' : 'Become an expert'} says="Get booked for jobs on Hanzo.">
      {!known.account ? (
        <XStack gap="$2" flexWrap="wrap" items="center">
          <Act onPress={connecting}>Continue with GitHub</Act>
          <Refusal says={joining ?? said} />
        </XStack>
      ) : null}
      <Refusal says={known.unread} />
      <Panel gap="$4">
        <Field label="Name or headline" value={form.title} set={(title) => put({ title })} name="title" />
        <Words label="Description" value={form.description} set={(description) => put({ description })} hint="What you do and what you have shipped." rows={3} />
        <Pick label="Areas" of={AREAS.map((a) => ({ value: a.slug, label: a.label }))} value={form.areas} set={(areas) => put({ areas })} help={FREELANCE} />
        <Chips label="Skills" value={form.skills} set={(skills) => put({ skills })} max={LIMITS.skills} ok={(v) => v.length <= LIMITS.skill} />
        <Spoken value={form.languages} set={(languages) => put({ languages })} />
        <XStack gap="$3" flexWrap="wrap" items="flex-end">
          <Choice label="Time zone" value={form.timezone} set={(timezone) => put({ timezone })} of={zones(form.timezone).map((z) => ({ value: z, label: z }))} />
          <YStack gap="$2" flex={2} minW={260}>
            <Text fontSize="$2" color="$soft">
              Availability
            </Text>
            <XStack gap="$2" flexWrap="wrap" items="center" role="group" aria-label="Availability">
              {HOURS.map((h) => (
                <Act key={h.slug} on={form.hours === h.slug} onPress={() => put({ hours: form.hours === h.slug ? '' : h.slug })}>
                  {h.label}
                </Act>
              ))}
              <Entry label="Availability note" value={form.note} set={(note) => put({ note })} hint="Weekdays 9-17 PT" />
            </XStack>
          </YStack>
        </XStack>
        <XStack gap="$3" flexWrap="wrap" items="flex-end">
          <One
            label="Rate"
            of={[
              { value: 'rate', label: 'Hourly' },
              { value: 'price', label: 'Fixed' },
            ]}
            value={form.fee}
            set={(next) => next && put(next === 'rate' ? { fee: 'rate', price: '' } : { fee: 'price', rate: '' })}
          />
          <Field label={fee.label} value={fee.value} set={(v) => put(form.fee === 'rate' ? { rate: v } : { price: v })} hint={fee.hint} name="fee" />
          {priced ? <Payout wallets={pay.it?.wallets ?? []} value={recipient} set={(r) => put({ recipient: r })} /> : null}
        </XStack>
        <Chips label="Links" value={form.links} set={(links) => put({ links })} max={LIMITS.links} ok={link} show={(v) => v.replace(/^https:\/\//, '')} />
        {known.program ? <Tick label="Show my Hanzo level and badges" checked={shown} set={setShown} /> : null}
        <XStack items="center" gap="$3" flexWrap="wrap">
          <Act loud disabled={blocked !== null || busy} onPress={save}>
            {own ? 'Save' : 'Publish'}
          </Act>
          {blocked ? (
            <Text fontSize="$2" color="$quiet" data-blocked="">
              {blocked}
            </Text>
          ) : null}
        </XStack>
        <Refusal says={failed} />
        {status === 409 ? (
          <XStack>
            <Act onPress={reread}>Edit your expert listing</Act>
          </XStack>
        ) : null}
      </Panel>
    </Page>
  )
}
