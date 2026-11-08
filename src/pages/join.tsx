// Become an expert. Any signed-in member lists themself: the form writes one
// `expert` listing, which people book through the same job as an agent. A person
// has one, so a member who already has it is shown it to edit, not a blank form.
// Payment needs the org's payout wallet, chosen the way a seller's listing
// chooses it.

import { useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'
import { useNavigate } from 'react-router'

import { AREAS, change, check, create, fill, FREELANCE, language, LANGUAGES, LIMITS, mine, zones, type Form } from '~/lib/expert'
import { ownListings, publish, updateListing, wallets, type Listing } from '~/lib/market'
import { free, valid } from '~/lib/money'
import { useRead, useRun } from '~/lib/read'
import { Gate } from '~/gate'
import { Payout } from '~/pages/listings'
import { useSession } from '~/session'
import { Act, Choice, Failed, Field, Fields, Nothing, Page, Panel, Refusal, Words } from '~/ui'

export function Join() {
  return (
    <Gate why="An expert listing belongs to your Hanzo account.">
      <Own />
    </Gate>
  )
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
  const own = mine(rows.it)
  return <Editor key={own?.id ?? 'new'} own={own} reread={rows.again} />
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

function Editor({ own, reread }: { own: Listing | null; reread: () => void }) {
  const go = useNavigate()
  const session = useSession()
  const [form, setForm] = useState<Form>(() => fill(own, Intl.DateTimeFormat().resolvedOptions().timeZone))
  const put = (next: Partial<Form>) => setForm((f) => ({ ...f, ...next }))
  const pay = useRead(() => wallets(), [session.org])
  const { busy, failed, status, run } = useRun()

  const priced = [form.rate, form.price].some((a) => valid(a.trim()) && !free(a))
  const recipient = form.recipient || pay.it?.wallets[0]?.id || ''
  const blocked = check({ ...form, recipient })
  const extra = form.languages.filter((l) => !(LANGUAGES as readonly string[]).includes(l))

  const save = () =>
    void run(async () => {
      const f = { ...form, recipient }
      const saved = own ? await updateListing(own.id, change(f)) : await publish(create(f))
      await go(`/experts/${encodeURIComponent(saved.id)}`)
    })

  return (
    <Page eyebrow="Experts" title={own ? 'Your expert listing' : 'Become an expert'} says="Get booked for jobs on Hanzo.">
      <Panel gap="$4">
        <Field label="Name or headline" value={form.title} set={(title) => put({ title })} name="title" />
        <Words label="Description" value={form.description} set={(description) => put({ description })} hint="What you do and what you have shipped." rows={6} />
        <Pick label="Areas" of={AREAS.map((a) => ({ value: a.slug, label: a.label }))} value={form.areas} set={(areas) => put({ areas })} help={FREELANCE} />
        <Pick
          label="Languages"
          of={[...LANGUAGES, ...extra].map((code) => ({ value: code, label: language(code) }))}
          value={form.languages}
          set={(languages) => put({ languages })}
          max={LIMITS.languages}
        />
        <Fields>
          <Choice label="Time zone" value={form.timezone} set={(timezone) => put({ timezone })} of={zones(form.timezone).map((z) => ({ value: z, label: z }))} />
          <Field label="Availability" value={form.availability} set={(availability) => put({ availability })} hint="Weekdays 9-17 PT" name="availability" />
        </Fields>
        <Fields>
          <Field label="Hourly rate (USD)" value={form.rate} set={(rate) => put({ rate })} hint="150" name="rate" help="Leave one of the two empty." />
          <Field label="Fixed price (USD)" value={form.price} set={(price) => put({ price })} hint="500" name="price" />
          {priced ? <Payout wallets={pay.it?.wallets ?? []} value={recipient} set={(r) => put({ recipient: r })} /> : null}
        </Fields>
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
