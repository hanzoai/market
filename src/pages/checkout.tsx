// Checkout. A platform tool is installed and paid per call over x402. Everything a
// seller lists is hired for a job: clearance first, in plain words, then the
// buyer's wallet signs an x402 payment for exactly that job, which cloud sets
// aside until the buyer releases it. A payment whose answer never came back is
// sent again as it was, never signed anew, so one hire opens one job: this
// browser keeps it until the platform answers, through a reload and in every tab.

import { useEffect, useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'
import { useNavigate, useParams } from 'react-router'

import { sellerName } from '~/lib/catalog'
import { answers, asksWhere, facts, headline, net, netOnly, payable, todos, withholding } from '~/lib/clearance'
import { lost as unanswered, notServed } from '~/lib/http'
import { words } from '~/lib/job'
import { claim, clearance, forget, hire, hires, install, keep, save, saved, shopListing, Taken, underway, wallets, type Attempt, type ClearIn, type Clearance, type Job, type ShopListing, type Wallet } from '~/lib/market'
import { dollars, each, free, usd } from '~/lib/money'
import { nonce, onHanzo } from '~/lib/x402'
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
  return listing.it.kind === 'tool' ? <PerCall listing={listing.it} /> : <Hire key={listing.it.id} listing={listing.it} />
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
 * One hire is one attempt, kept by this browser from its first ask until the
 * platform answers it. If the answer never comes back, the attempt is the only
 * hire offered for this listing until it is answered, and it is sent again as it
 * was — the same terms, deadline, authorization and signed payment — which cloud
 * answers with the job it opened: a second payment could open a second job while
 * the first may still be funding. Only an attempt the wallet was never asked to
 * sign may be dropped. A new attempt first asks whether the org already has a job
 * under way for exactly these terms, and whether another tab has a hire kept.
 */
function Hire({ listing }: { listing: ShopListing }) {
  const go = useNavigate()
  const session = useSession()
  const org = session.org ?? ''
  const mine = useRead(() => wallets(), [session.org])
  // The attempt whose answer never came back, from this page, an earlier one or another tab.
  const [kept, setKept] = useState(() => saved(org, listing.id))
  // Whether it is in this browser's storage, shared with every tab (storage can be refused).
  const [shared, setShared] = useState(true)
  const [brief, setBrief] = useState('')
  const [amount, setAmount] = useState(dollars(listing.price) ?? '')
  const [days, setDays] = useState('7')
  const [where, setWhere] = useState('')
  const [wallet, setWallet] = useState('')
  const [asked, setAsked] = useState<ClearIn | null>(null)
  const check = useRead(asked ? () => clearance(asked) : null, [asked?.payee, asked?.amount, asked?.performed])
  const { busy, failed, status, run } = useRun()
  // A job already under way for these terms, found before a new quote.
  const [already, setAlready] = useState<Job | null>(null)
  // The buyer saw that job and hires again anyway.
  const [again, setAgain] = useState(false)

  // Only a wallet on the Hanzo L1 can pay: that is the one chain the rail settles on.
  const list = (mine.it?.wallets ?? []).filter((w) => onHanzo(w.chain))
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

  // Another tab kept a hire, or the platform answered one there: this tab shows the same.
  useEffect(() => {
    const follow = (e: StorageEvent) => {
      if (hires(e.key)) setKept(saved(org, listing.id))
    }
    window.addEventListener('storage', follow)
    return () => window.removeEventListener('storage', follow)
  }, [org, listing.id])

  // Asked once where the work is performed, the question stays on the form.
  const [askWhere, setAskWhere] = useState(false)
  useEffect(() => {
    if (asksWhere(decided)) setAskWhere(true)
  }, [decided])

  /**
   * Send a kept attempt until the platform answers it. Shared, it is read back and
   * kept at each step (drawn, signed), so what another tab did with it is taken up
   * and an answer there ends it here.
   */
  const send = async (a: Attempt, inStore: boolean) => {
    try {
      const opened = await hire(a, inStore ? keep(org, listing.id) : undefined)
      forget(org, listing.id, a, true)
      setKept(null)
      await go(`/jobs/${encodeURIComponent(opened.id)}`)
    } catch (e) {
      if (e instanceof Taken) {
        // Another tab answered, dropped or replaced it: show what is kept now.
        setKept(saved(org, listing.id))
      } else if (unanswered(e)) {
        // Unanswered: keep the attempt as it stands, with whatever another tab added.
        save(org, listing.id, a)
        setKept({ ...a })
      } else {
        // Answered: it is over, and the form is the buyer's again — unless another
        // tab drew or signed with it meanwhile, whose payment may still open a job.
        setKept(forget(org, listing.id, a) ? null : saved(org, listing.id))
      }
      throw e
    }
  }

  const pay = () =>
    void run(async () => {
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
      const a: Attempt = { id: nonce(), req, from: { id: payer.id, address: payer.address, chain: payer.chain } }
      // Kept before the first ask — unless another tab kept one meanwhile, which is shown instead.
      const { had, kept: inStore } = claim(org, listing.id, a)
      if (had) return setKept(had)
      setShared(inStore)
      await send(a, inStore)
    })

  // Drop an attempt the wallet was never asked to sign — unless another tab has asked it since.
  const drop = () => {
    if (!kept) return
    const now = saved(org, listing.id)
    if (now?.id === kept.id && now.auth) return setKept(now)
    setKept(forget(org, listing.id, kept) ? null : saved(org, listing.id))
  }

  const title = { eyebrow: 'Hire', title: listing.title, says: `Sold by ${sellerName(listing.seller.org)} · ${free(listing.price) ? 'Price agreed per job' : each(listing.price, listing.kind)}` }

  if (kept) {
    return (
      <Page {...title}>
        <Stages
          of={[
            { label: '1 Clearance', stage: 'done' },
            { label: '2 Pay', stage: 'current' },
            { label: '3 Job opened', stage: 'todo' },
          ]}
        />
        <Section title="Your hire" says="The platform’s answer to it never came back. Until it does, this is the one hire offered here for this listing, in every tab.">
          <Panel>
            <Unanswered attempt={kept} />
            <XStack items="center" gap="$3" flexWrap="wrap">
              <Act loud disabled={busy} onPress={() => void run(() => send(kept, shared))}>
                {kept.signed ? 'Send the same payment again' : 'Ask again with the same terms'}
              </Act>
              {kept.auth ? (
                <Go to="/jobs">Your jobs</Go>
              ) : (
                <Act disabled={busy} onPress={drop}>
                  Start over
                </Act>
              )}
            </XStack>
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

  return (
    <Page {...title}>
      <Stages
        of={[
          { label: '1 Clearance', stage: cleared ? 'done' : 'current' },
          { label: '2 Pay', stage: cleared ? 'current' : 'todo' },
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
          <Payer read={mine} list={list} value={payer?.id ?? ''} set={setWallet} />
          {dup ? (
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
            <Act loud disabled={!ready || dup !== null} onPress={pay}>
              {gross ? `Pay ${usd(gross)} and open the job` : 'Pay and open the job'}
            </Act>
          </XStack>
          {!cleared ? (
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

const due = (a: Attempt) => new Date(a.req.deadline * 1000).toISOString().slice(0, 10)

/** An attempt whose answer never came back: what it asked, what the wallet signed, and why sending it again is safe. */
function Unanswered({ attempt }: { attempt: Attempt }) {
  const { req, auth, signed } = attempt
  return (
    <YStack gap="$2" data-unanswered="">
      <Mark tone="act" says="The platform’s answer never came back" />
      <Text fontSize="$3" color="$ink">
        {`${usd(req.amount)} for “${req.brief}”, delivered by ${due(attempt)}, from wallet ${req.wallet}.`}
      </Text>
      <Text fontSize="$2" color="$soft">
        {signed
          ? `Your wallet signed ${usd(signed.amount)} in USD Coin to ${signed.payTo} for job ${signed.job}. The platform may already have opened it. Sending the same payment again is safe: it answers with the job it opened, or opens it once.`
          : auth
            ? 'Your wallet was asked to sign, and its answer never came back, so it may have signed. Asking again signs the same authorization, with the same nonce, so at most one payment can ever move money.'
            : 'Nothing was signed. Asking again with the same terms and deadline gets the same quote, not a second one.'}
      </Text>
    </YStack>
  )
}

function Payer({ read, list, value, set }: { read: Read<unknown>; list: Wallet[]; value: string; set: (v: string) => void }) {
  if (list.length) return <Choice label="Pay from wallet" value={value} set={set} of={list.map((w) => ({ value: w.id, label: `${w.name} · ${w.chain || 'any chain'}` }))} />
  return (
    <YStack gap="$2">
      <Text fontSize="$2" color="$soft">
        Pay from wallet
      </Text>
      <Text fontSize="$2" color="$quiet">
        {read.failed ? read.failed : read.it ? 'Your organization has no wallet on the Hanzo L1 yet.' : 'Loading wallets…'}
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
