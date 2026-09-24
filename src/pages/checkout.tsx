// Checkout: clearance first, in plain words, then payment over x402 (per call)
// or into on-chain escrow (a job).

import { useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import { cleared, headline, steps, withholding } from '~/lib/clearance'
import { notServed } from '~/lib/http'
import { clearance, hire, install, shopListing, wallets, type Clearance, type Rail, type ShopListing } from '~/lib/market'
import { free, perCall, usd, valid } from '~/lib/money'
import { useRead, useRun } from '~/lib/read'
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
  const [params] = useSearchParams()
  const rail: Rail = params.get('rail') === 'escrow' ? 'escrow' : 'x402'
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
  return <Flow listing={listing.it} rail={rail} />
}

function Flow({ listing, rail }: { listing: ShopListing; rail: Rail }) {
  const check = useRead(() => clearance(listing.id, rail), [listing.id, rail])
  const [paid, setPaid] = useState(false)
  const pending = notServed(check.status)
  const ok = pending || (check.it !== null && cleared(check.it))

  return (
    <Page
      eyebrow={rail === 'escrow' ? 'Hire with escrow' : 'Pay per call over x402'}
      title={listing.title}
      says={`Sold by ${listing.publisherName || listing.publisherOrg} · ${free(listing.price) ? 'Free' : perCall(listing.price, listing.kind)}`}
    >
      <Stages
        of={[
          { label: '1 Clearance', stage: check.loading ? 'current' : ok ? 'done' : 'current' },
          { label: '2 Pay', stage: paid ? 'done' : ok ? 'current' : 'todo' },
          { label: rail === 'escrow' ? '3 Job opened' : '3 Installed', stage: paid ? 'done' : 'todo' },
        ]}
      />

      <Section title="Clearance" says="Before any money moves, the platform checks that both sides can transact.">
        <Cleared check={check.it} failed={check.failed} pending={pending} loading={check.loading} again={check.again} />
      </Section>

      <Section title="Payment">
        {!ok ? (
          <Text fontSize="$2" color="$quiet">
            Finish clearance first.
          </Text>
        ) : rail === 'escrow' ? (
          <Escrow listing={listing} />
        ) : (
          <PerCall listing={listing} onPaid={() => setPaid(true)} />
        )}
      </Section>
    </Page>
  )
}

function Cleared({
  check,
  failed,
  pending,
  loading,
  again,
}: {
  check: Clearance | null
  failed: string | null
  pending: boolean
  loading: boolean
  again: () => void
}) {
  if (loading) return <Nothing says="Checking clearance…" />
  if (pending) {
    return (
      <Pending
        what="Clearance check is not live yet"
        says="api.hanzo.ai does not answer /v1/principal/clearance yet. The platform still enforces clearance when you pay, and any refusal it gives is shown below in its own words."
      />
    )
  }
  if (failed || !check) {
    return (
      <YStack gap="$2">
        <Failed what="check clearance" why={failed ?? 'No answer.'} />
        <XStack>
          <Act onPress={again}>Check again</Act>
        </XStack>
      </YStack>
    )
  }
  const todo = steps(check)
  const held = withholding(check)
  return (
    <Panel>
      <Mark tone={cleared(check) ? 'up' : 'act'} says={headline(check)} />
      {todo.map((s) => (
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
      {held ? (
        <Text fontSize="$2" color="$ink" data-withholding="">
          {held}
        </Text>
      ) : (
        <Text fontSize="$2" color="$quiet">
          Nothing is withheld from this payment.
        </Text>
      )}
    </Panel>
  )
}

function PerCall({ listing, onPaid }: { listing: ShopListing; onPaid: () => void }) {
  const session = useSession()
  const { busy, failed, status, run } = useRun()
  const [done, setDone] = useState(false)
  const priced = !free(listing.price)

  if (done) {
    return (
      <Panel>
        <Mark tone="up" says={`Installed for ${session.org ?? 'your organization'}`} />
        <Text fontSize="$2" color="$soft">
          {priced
            ? `Each call costs ${usd(listing.price)} and settles over x402 to ${listing.publisherName || listing.publisherOrg}. Every call returns a receipt.`
            : 'This listing is free to call.'}
        </Text>
        <XStack>
          <Go to={`/l/${encodeURIComponent(listing.id)}`}>Back to the listing</Go>
        </XStack>
      </Panel>
    )
  }

  return (
    <Panel>
      <Text fontSize="$3" color="$ink">
        {priced
          ? `You pay ${usd(listing.price)} per call. Nothing is charged now: each call your organization makes settles over x402, straight to the seller’s wallet.`
          : 'This listing is free. Installing activates it for your organization.'}
      </Text>
      <XStack>
        <Act
          loud
          disabled={busy}
          onPress={() =>
            void run(async () => {
              await install(listing.tool)
              setDone(true)
              onPaid()
            })
          }
        >
          {priced ? 'Install and pay per call' : 'Install'}
        </Act>
      </XStack>
      {failed && notServed(status) ? <Pending what="Install is not live yet" says={failed} /> : <Refusal says={failed} />}
    </Panel>
  )
}

function Escrow({ listing }: { listing: ShopListing }) {
  const go = useNavigate()
  const mine = useRead(() => wallets(), [])
  const [brief, setBrief] = useState('')
  const [amount, setAmount] = useState(free(listing.price) ? '' : listing.price)
  const [wallet, setWallet] = useState('')
  const { busy, failed, status, run } = useRun()
  const list = mine.it?.wallets ?? []
  const chosen = wallet || list[0]?.id || ''
  const ready = brief.trim().length > 0 && valid(amount) && !free(amount) && chosen !== ''

  return (
    <Panel gap="$4">
      <Text fontSize="$3" color="$ink">
        The amount is locked in an on-chain escrow when the job opens. The seller is paid only when you release it after
        delivery; a dispute keeps the funds held until it is resolved.
      </Text>
      <Words label="What do you need done?" value={brief} set={setBrief} hint="Describe the job and what delivered looks like." />
      <XStack gap="$3" flexWrap="wrap">
        <Field label="Amount (USD)" value={amount} set={setAmount} hint="250.00" name="amount" />
        {list.length ? (
          <Choice
            label="Fund from wallet"
            value={chosen}
            set={setWallet}
            of={list.map((w) => ({ value: w.id, label: `${w.name} · ${w.chain}` }))}
          />
        ) : (
          <YStack gap="$2" flex={1} minW={200}>
            <Text fontSize="$2" color="$soft">
              Fund from wallet
            </Text>
            <Text fontSize="$2" color="$quiet">
              {mine.failed ? mine.failed : mine.it ? 'Your organization has no wallet yet.' : 'Loading wallets…'}
            </Text>
            {mine.it ? <Go to="/sell">Create a wallet</Go> : null}
          </YStack>
        )}
      </XStack>
      <XStack items="center" gap="$3" flexWrap="wrap">
        <Act
          loud
          disabled={!ready || busy}
          onPress={() =>
            void run(async () => {
              const opened = await hire({ listing: listing.id, brief: brief.trim(), amount: amount.trim(), wallet: chosen })
              await go(`/jobs/${encodeURIComponent(opened.id)}`)
            })
          }
        >
          {valid(amount) && !free(amount) ? `Fund ${usd(amount)} into escrow` : 'Fund escrow'}
        </Act>
      </XStack>
      {failed && notServed(status) ? (
        <Pending what="Escrow is not live yet" says="api.hanzo.ai does not answer POST /v1/marketplace/jobs yet." />
      ) : (
        <Refusal says={failed} />
      )}
    </Panel>
  )
}
