// Checkout. A platform tool is installed and paid per call over x402. Everything a
// seller lists is hired for a job: clearance first, in plain words, then the
// buyer's wallet signs an x402 payment for exactly that job, which cloud sets
// aside until the buyer releases it. A payment whose answer never came back is
// sent again as it was, never signed anew, so one hire opens one job.

import { useEffect, useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'
import { useNavigate, useParams } from 'react-router'

import { sellerName } from '~/lib/catalog'
import { answers, asksWhere, facts, headline, net, netOnly, payable, todos, withholding } from '~/lib/clearance'
import { lost as unanswered, notServed } from '~/lib/http'
import { words } from '~/lib/job'
import { clearance, hire, install, shopListing, underway, wallets, type Attempt, type ClearIn, type Clearance, type Job, type ShopListing } from '~/lib/market'
import { dollars, each, free, usd } from '~/lib/money'
import { useRead, useRun, type Read } from '~/lib/read'
import { Gate } from '~/gate'
import { useSession } from '~/session'
import { Act, Choice, Failed, Field, Go, Mark, Nothing, Page, Panel, Pending, Refusal, Section, Stages, Words } from '~/ui'

export function Checkout() {
  return (
    <Gate why="Checkout pays from your organization, so it needs to know who you are.">
      <Inner />
    </Gate>
  )
}

function Inner() {
  const { id = '' } = useParams()
  const listing = useRead(() => shopListing(id), [id])

  if (listing.failed) {
    return (
      <Page title="Checkout">
        {notServed(listing.status) ? (
          <Pending what="This listing cannot be loaded" says={listing.failed} />
        ) : (
          <Failed what="load this listing" why={listing.failed} />
        )}
      </Page>
    )
  }
  if (!listing.it) return <Nothing says="Loading…" />
  return listing.it.kind === 'tool' ? <PerCall listing={listing.it} /> : <Hire listing={listing.it} />
}

/** A platform tool: installed for the org, and each call settles over x402. */
function PerCall({ listing }: { listing: ShopListing }) {
  const session = useSession()
  const { busy, failed, status, run } = useRun()
  const [done, setDone] = useState(false)
  const priced = !free(listing.price)

  return (
    <Page eyebrow="Pay per call over x402" title={listing.title} says={`Sold by ${sellerName(listing.seller.org)} · ${priced ? each(listing.price, listing.kind) : 'Free'}`}>
      <Stages
        of={[
          { label: '1 Install', stage: done ? 'done' : 'current' },
          { label: '2 Pay per call', stage: done ? 'current' : 'todo' },
        ]}
      />
      <Section title="Payment" says="Nothing is charged now. Each call your organization makes settles over x402 and returns a receipt.">
        {done ? (
          <Panel>
            <Mark tone="up" says={`Installed for ${session.org ?? 'your organization'}`} />
            <Text fontSize="$2" color="$soft">
              {priced ? `Each call costs ${usd(listing.price)} and settles over x402 to ${sellerName(listing.seller.org)}.` : 'This tool is free to call.'}
            </Text>
            <XStack>
              <Go to={`/l/${encodeURIComponent(listing.id)}`}>Back to the listing</Go>
            </XStack>
          </Panel>
        ) : (
          <Panel>
            <Text fontSize="$3" color="$ink">
              {priced ? `You pay ${usd(listing.price)} per call, straight to the seller.` : 'This tool is free. Installing activates it for your organization.'}
            </Text>
            <XStack>
              <Act loud disabled={busy} onPress={() => void run(async () => (await install(listing.tool), setDone(true)))}>
                {priced ? 'Install and pay per call' : 'Install'}
              </Act>
            </XStack>
            {failed && notServed(status) ? <Pending what="Install is not live yet" says={failed} /> : <Refusal says={failed} />}
          </Panel>
        )}
      </Section>
    </Page>
  )
}

const DAYS = [
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
]

const alpha2 = (v: string) => (/^[A-Za-z]{2}$/.test(v.trim()) ? v.trim().toUpperCase() : '')

/**
 * A job. The buyer states the work and the amount, and clearance decides that
 * payment — this payee, this amount, where it is performed — before anything is
 * signed. Payment waits on a finished clearance of exactly what it pays, which
 * the platform allowed in full; cloud clears the job again when it is quoted,
 * funded and released.
 *
 * One hire is one attempt. If its answer never comes back, the attempt is kept
 * and sent again as it was — the same terms, deadline and signed payment — which
 * cloud answers with the job it opened. A new attempt first asks whether the org
 * already has a job under way for exactly these terms.
 */
function Hire({ listing }: { listing: ShopListing }) {
  const go = useNavigate()
  const session = useSession()
  const mine = useRead(() => wallets(), [session.org])
  const [brief, setBrief] = useState('')
  const [amount, setAmount] = useState(dollars(listing.price) ?? '')
  const [days, setDays] = useState('7')
  const [where, setWhere] = useState('')
  const [wallet, setWallet] = useState('')
  const [asked, setAsked] = useState<ClearIn | null>(null)
  const check = useRead(asked ? () => clearance(asked) : null, [asked?.payee, asked?.amount, asked?.performed])
  const { busy, failed, status, run } = useRun()
  // The attempt whose answer never came back: the next press sends it again, unchanged.
  const [lost, setLost] = useState<Attempt | null>(null)
  // A job already under way for these terms, found before a new quote.
  const [already, setAlready] = useState<Job | null>(null)
  // The buyer saw that job and hires again anyway.
  const [again, setAgain] = useState(false)

  const list = mine.it?.wallets ?? []
  const payer = list.find((w) => w.id === wallet) ?? list[0] ?? null
  const gross = dollars(amount)
  const want: ClearIn | null = gross
    ? { payee: listing.publisherOrg, amount: gross, category: 'services', rail: 'x402', performed: alpha2(where) || undefined }
    : null
  const current = asked !== null && want !== null && asked.amount === want.amount && (asked.performed ?? '') === (want.performed ?? '')
  // Only a finished clearance of exactly this payment counts.
  const decided = current && !check.loading && check.it && answers(check.it, want) ? check.it : null
  const cleared = decided !== null && payable(decided)
  const ready = cleared && brief.trim().length > 0 && payer !== null && !busy
  const dup = already && already.brief === brief.trim() && dollars(already.amount) === gross ? already : null

  // Asked once where the work is performed, the question stays on the form.
  const [askWhere, setAskWhere] = useState(false)
  useEffect(() => {
    if (asksWhere(decided)) setAskWhere(true)
  }, [decided])

  const pay = () =>
    void run(async () => {
      let a = lost
      if (!a) {
        if (!want || !payer) return
        const req = {
          listing: listing.id,
          brief: brief.trim(),
          amount: want.amount,
          category: 'service' as const,
          performed: want.performed,
          deadline: Math.floor(Date.now() / 1000) + Number(days) * 86_400,
          wallet: payer.id,
        }
        if (again) setAgain(false)
        else {
          const had = await underway(req)
          if (had) return setAlready(had)
        }
        a = { req, from: { id: payer.id, address: payer.address } }
      }
      try {
        const opened = await hire(a)
        setLost(null)
        await go(`/jobs/${encodeURIComponent(opened.id)}`)
      } catch (e) {
        // Unanswered: keep the attempt, with the payment it signed. Answered: it is over.
        setLost(unanswered(e) ? { ...a } : null)
        throw e
      }
    })

  return (
    <Page eyebrow="Hire" title={listing.title} says={`Sold by ${sellerName(listing.seller.org)} · ${free(listing.price) ? 'Price agreed per job' : each(listing.price, listing.kind)}`}>
      <Stages
        of={[
          { label: '1 Clearance', stage: cleared || lost ? 'done' : 'current' },
          { label: '2 Pay', stage: cleared || lost ? 'current' : 'todo' },
          { label: '3 Job opened', stage: 'todo' },
        ]}
      />

      <Section title="The job" says="The amount is set aside in your wallet when the job opens, and paid to the seller only when you release it after delivery. If the job ends unpaid, it comes back.">
        <Panel gap="$4">
          <Words label="What do you need done?" value={brief} set={setBrief} hint="Describe the job and what delivered looks like." />
          <XStack gap="$3" flexWrap="wrap">
            <Field label="Amount (USD)" value={amount} set={setAmount} hint="250.00" name="amount" help={amount && !gross ? 'A job is paid in whole cents.' : undefined} />
            <Choice label="Deliver within" value={days} set={setDays} of={DAYS} />
            {askWhere ? (
              <Field label="Where the work is performed (2 letters)" value={where} set={setWhere} hint="US" name="performed" />
            ) : null}
          </XStack>
          <XStack>
            <Act disabled={!want || current} onPress={() => want && setAsked(want)}>
              {current ? 'Clearance checked' : 'Check clearance'}
            </Act>
          </XStack>
        </Panel>
      </Section>

      <Section title="Clearance" says="Before any money moves, the platform decides whether your organization may pay this seller this amount.">
        {asked ? (
          <Cleared read={check} decided={decided} stale={!current} />
        ) : (
          <Text fontSize="$2" color="$quiet">
            State the amount, then check clearance.
          </Text>
        )}
      </Section>

      <Section title="Payment" says="Your wallet signs an x402 payment for exactly the amount cleared, to the seller, for this job, and nothing else; the platform holds the signature, not the money.">
        <Panel>
          {lost ? (
            <Unanswered attempt={lost} />
          ) : (
            <Payer read={mine} value={payer?.id ?? ''} set={setWallet} />
          )}
          {dup && !lost ? (
            <YStack gap="$2" data-underway="">
              <Text fontSize="$2" color="$ink">
                {`Your organization already has job ${dup.id} under way for exactly this: ${usd(dup.amount, dup.currency)}, ${words(dup).split(' — ')[0].toLowerCase()}. Hiring again opens a second job and sets the amount aside twice.`}
              </Text>
              <XStack gap="$2" flexWrap="wrap">
                <Go to={`/jobs/${encodeURIComponent(dup.id)}`}>{`Open ${dup.id}`}</Go>
                <Act onPress={() => (setAgain(true), setAlready(null))}>Hire again anyway</Act>
              </XStack>
            </YStack>
          ) : null}
          <XStack items="center" gap="$3" flexWrap="wrap">
            <Act loud disabled={lost ? busy : !ready || dup !== null} onPress={pay}>
              {lost ? (lost.signed ? 'Send the same payment again' : 'Ask again with the same terms') : gross ? `Pay ${usd(gross)} and open the job` : 'Pay and open the job'}
            </Act>
            {lost ? (
              <Act disabled={busy} onPress={() => setLost(null)}>
                Start over
              </Act>
            ) : null}
          </XStack>
          {!cleared && !lost ? (
            <Text fontSize="$2" color="$quiet">
              Payment waits on a clearance of this amount.
            </Text>
          ) : null}
          {failed && notServed(status) ? (
            <Pending what="Hiring is not live yet" says="api.hanzo.ai does not answer POST /v1/marketplace/jobs yet." />
          ) : (
            <Refusal says={failed} />
          )}
        </Panel>
      </Section>
    </Page>
  )
}

/** An attempt whose answer never came back: what it holds, and why sending it again is safe. */
function Unanswered({ attempt }: { attempt: Attempt }) {
  const s = attempt.signed
  return (
    <YStack gap="$2" data-unanswered="">
      <Mark tone="act" says="The platform’s answer never came back" />
      <Text fontSize="$2" color="$soft">
        {s
          ? `Your wallet signed ${usd(s.amount)} in USD Coin to ${s.payTo} for job ${s.job}. The platform may already have opened it. Sending the same payment again is safe: it answers with the job it opened, or opens it once.`
          : `Nothing was signed yet. Asking again with the same terms and deadline (${usd(attempt.req.amount)}) gets the same quote, not a second one.`}
      </Text>
    </YStack>
  )
}

function Payer({ read, value, set }: { read: Read<{ wallets: { id: string; name: string; chain: string }[] }>; value: string; set: (v: string) => void }) {
  const list = read.it?.wallets ?? []
  if (list.length) return <Choice label="Pay from wallet" value={value} set={set} of={list.map((w) => ({ value: w.id, label: `${w.name} · ${w.chain}` }))} />
  return (
    <YStack gap="$2">
      <Text fontSize="$2" color="$soft">
        Pay from wallet
      </Text>
      <Text fontSize="$2" color="$quiet">
        {read.failed ? read.failed : read.it ? 'Your organization has no wallet yet.' : 'Loading wallets…'}
      </Text>
      {read.it ? <Go to="/sell">Create a wallet</Go> : null}
    </YStack>
  )
}

function Cleared({ read, decided, stale }: { read: Read<Clearance>; decided: Clearance | null; stale: boolean }) {
  if (stale) {
    return (
      <Text fontSize="$2" color="$quiet">
        The terms changed. Check clearance again.
      </Text>
    )
  }
  if (read.loading) return <Nothing says="Checking clearance…" />
  if (notServed(read.status)) {
    return (
      <Pending
        what="Clearance is not live yet"
        says="api.hanzo.ai does not answer POST /v1/principal/clearance yet, and no job is paid without it."
      />
    )
  }
  if (read.failed || !decided) {
    return (
      <YStack gap="$2">
        <Failed what="check clearance" why={read.failed ?? 'The platform answered for a different payment.'} />
        <XStack>
          <Act onPress={read.again}>Check again</Act>
        </XStack>
      </YStack>
    )
  }
  const held = withholding(decided)
  const seller = net(decided)
  const whole = netOnly(decided)
  return (
    <Panel>
      <Mark tone={payable(decided) ? 'up' : 'act'} says={headline(decided)} />
      {todos(decided.required_before_payment).map((s) => (
        <YStack key={s.title + s.body} gap="$1" py="$2" borderTopWidth={1} borderColor="$borderColor" data-need="">
          <Text fontSize="$3" color="$ink" fontWeight="500">
            {s.title}
          </Text>
          <Text fontSize="$2" color="$soft">
            {s.body}
          </Text>
          {s.to ? (
            <XStack pt="$1">
              <Go to={s.to}>Do this now</Go>
            </XStack>
          ) : null}
        </YStack>
      ))}
      {facts(decided).map((f) => (
        <Text key={f.question} fontSize="$2" color={f.blocks ? '$ink' : '$soft'} data-fact={f.code}>
          {f.blocks ? 'Needed first: ' : 'Worth knowing: '}
          {f.question}
          {f.blocks && f.code === 'performed' ? ' Answer it under “Where the work is performed” and check clearance again.' : ''}
        </Text>
      ))}
      {held ? (
        <Text fontSize="$2" color="$ink" data-withholding="">
          {held}
        </Text>
      ) : (
        <Text fontSize="$2" color="$quiet">
          Nothing is withheld from this payment.
        </Text>
      )}
      {seller ? (
        <Text fontSize="$2" color="$soft">
          {seller}
        </Text>
      ) : null}
      {whole ? (
        <Text fontSize="$2" color="$ink" data-net-only="">
          {whole}
        </Text>
      ) : null}
    </Panel>
  )
}
