// Seller onboarding. The org is the economic principal: it is verified, it files
// the tax form, it is paid into its wallet, and it receives the 1099s.

import { useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'
import { NavLink } from 'react-router'

import { web } from '~/lib/api'
import { notServed } from '~/lib/http'
import {
  certifyTax,
  createAccount,
  createWallet,
  principal,
  saveTaxProfile,
  setPayout,
  startKyc,
  taxProfile,
  wallets,
  type Classification,
  type Principal,
  type TaxProfile,
  type Wallet,
} from '~/lib/market'
import { useRead, useRun, type Read } from '~/lib/read'
import { Gate } from '~/gate'
import { useSession } from '~/session'
import { Act, Choice, Failed, Field, Fields, Mark, Nothing, Page, Panel, Pending, Refusal, Section, Stages, Tick } from '~/ui'

const SELL = [
  { to: '/sell', label: 'Set up' },
  { to: '/sell/listings', label: 'Listings' },
  { to: '/sell/jobs', label: 'Jobs' },
  { to: '/sell/earnings', label: 'Earnings' },
]

export function SellNav() {
  return (
    <XStack gap="$2" flexWrap="wrap" render="nav" aria-label="Sell">
      {SELL.map((s) => (
        <NavLink key={s.to} to={s.to} end style={{ textDecoration: 'none' }}>
          {({ isActive }) => (
            <YStack
              px="$4"
              py="$2"
              rounded="$10"
              borderWidth={1}
              borderColor={isActive ? '$ink' : '$borderColor'}
              bg={isActive ? '$hover' : 'transparent'}
              hoverStyle={{ bg: '$hover' }}
            >
              <Text fontSize="$2" color="$ink">
                {s.label}
              </Text>
            </YStack>
          )}
        </NavLink>
      ))}
    </XStack>
  )
}

export function Setup() {
  return (
    <Gate why="Selling is done by your organization. Sign in with your Hanzo account to set it up.">
      <Inner />
    </Gate>
  )
}

function Inner() {
  const session = useSession()
  const who = useRead(() => principal(), [session.org])
  const tax = useRead(() => taxProfile(), [session.org])
  const mine = useRead(() => wallets(), [session.org])

  const kyc = who.it?.kyc.status ?? (notServed(who.status) ? 'pending check' : '…')
  const taxState = tax.it ? tax.it.certification.status : notServed(tax.status) ? 'none' : '…'
  const payout = who.it?.payout.wallet ?? null

  return (
    <Page
      eyebrow="Sell"
      title="Set up your organization"
      says="Your organization is the seller: it is verified once, files one tax form, and is paid into one wallet. The same setup clears larger purchases."
    >
      <SellNav />
      <Stages
        of={[
          { label: 'Signed in', stage: 'done' },
          { label: `Identity: ${kyc}`, stage: who.it?.kyc.status === 'verified' ? 'done' : 'current' },
          { label: `Tax form: ${taxState}`, stage: taxState === 'certified' ? 'done' : 'current' },
          { label: payout ? 'Payout wallet set' : 'Payout wallet', stage: payout ? 'done' : 'todo' },
        ]}
      />

      <Section title="Organization" says="Everything below is filed for, and paid to, this organization.">
        <Panel>
          <Text fontSize="$3" color="$ink">
            {session.name || session.email || 'Signed in'}
            {session.email && session.name ? ` · ${session.email}` : ''}
          </Text>
          {session.orgs.length > 1 ? (
            <Choice
              label="Acting as"
              value={session.org ?? session.orgs[0]}
              set={session.choose}
              of={session.orgs.map((o) => ({ value: o, label: o }))}
            />
          ) : (
            <Text fontSize="$2" color="$soft" data-org="">
              Acting as {session.org ?? 'your personal organization'}
            </Text>
          )}
        </Panel>
      </Section>

      <Section title="Identity" says="Buyers and the platform need to know who is being paid.">
        <Identity read={who} />
      </Section>

      <Section title="Tax form" says="A W-9 if your organization is a US person, a W-8 if it is not. 1099s you receive are built from it.">
        <Tax read={tax} />
      </Section>

      <Section title="Payout wallet" says="Sales settle here: x402 payments per call, and escrow when a buyer releases a job.">
        <Payout wallets={mine} current={payout} payoutLive={!notServed(who.status)} onSet={who.again} onMade={mine.again} />
      </Section>
    </Page>
  )
}

function Identity({ read }: { read: Read<Principal> }) {
  const { busy, failed, run } = useRun()
  if (notServed(read.status)) {
    return (
      <Pending
        what="Seller verification is not live yet"
        says="api.hanzo.ai does not answer /v1/principal yet. Your verification status appears here as soon as it does."
      />
    )
  }
  if (read.failed) return <Failed what="load your organization" why={read.failed} />
  if (!read.it) return <Nothing says="Loading…" />
  const kyc = read.it.kyc
  return (
    <Panel>
      <Mark tone={kyc.status === 'verified' ? 'up' : kyc.status === 'rejected' ? 'act' : 'quiet'} says={`Status: ${kyc.status}`} />
      {kyc.status === 'verified' ? (
        <Text fontSize="$2" color="$soft">
          Verified. Nothing to do.
        </Text>
      ) : (
        <XStack>
          <Act
            loud
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const { verifyUrl } = await startKyc()
                const to = web(verifyUrl)
                if (!to) throw new Error('The platform returned no verification address.')
                window.open(to, '_blank', 'noopener')
                read.again()
              })
            }
          >
            {kyc.status === 'pending' ? 'Continue verification' : 'Verify your organization'}
          </Act>
        </XStack>
      )}
      <Refusal says={failed} />
    </Panel>
  )
}

const CLASSES: { value: Classification; label: string }[] = [
  { value: 'individual', label: 'Individual / sole proprietor' },
  { value: 'c_corp', label: 'C corporation' },
  { value: 's_corp', label: 'S corporation' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'trust_estate', label: 'Trust / estate' },
  { value: 'llc_c', label: 'LLC taxed as C corp' },
  { value: 'llc_s', label: 'LLC taxed as S corp' },
  { value: 'llc_p', label: 'LLC taxed as partnership' },
]

function Tax({ read }: { read: Read<TaxProfile> }) {
  const { busy, failed, run } = useRun()
  const [editing, setEditing] = useState(false)
  // The profile is 404 until an admin writes one: that is "none on file", not an outage.
  const none = notServed(read.status)
  if (read.failed && !none) return <Failed what="load your tax form" why={read.failed} />
  if (!read.it && !none) return <Nothing says="Loading…" />

  if (read.it && !editing) {
    const p = read.it
    const status = p.certification.status
    return (
      <Panel>
        <Mark tone={status === 'certified' ? 'up' : 'quiet'} says={`${p.form === 'w8ben' || p.form === 'w8bene' ? 'W-8' : 'W-9'} · ${status}`} />
        <Text fontSize="$2" color="$soft">
          {p.businessName || p.name} · TIN {p.tin}
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          {status !== 'certified' ? (
            <Act loud disabled={busy} onPress={() => void run(async () => (await certifyTax(), read.again()))}>
              Sign and certify
            </Act>
          ) : null}
          <Act onPress={() => setEditing(true)}>Edit</Act>
        </XStack>
        <Refusal says={failed} />
      </Panel>
    )
  }
  return <TaxForm onSaved={() => (setEditing(false), read.again())} />
}

function TaxForm({ onSaved }: { onSaved: () => void }) {
  const { busy, failed, run } = useRun()
  const [form, setForm] = useState<'w9' | 'w8'>('w9')
  const [name, setName] = useState('')
  const [business, setBusiness] = useState('')
  const [klass, setKlass] = useState<Classification>('c_corp')
  const [line1, setLine1] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [country, setCountry] = useState('')
  const [tinType, setTinType] = useState<'ein' | 'ssn'>('ein')
  const [tin, setTin] = useState('')
  const [entity, setEntity] = useState<'w8ben' | 'w8bene'>('w8bene')
  const [consent, setConsent] = useState(true)

  const us = form === 'w9'
  const ready = name.trim() && line1.trim() && city.trim() && (us ? state.trim() && zip.trim() && tin.trim() : country.trim())

  const save = () =>
    void run(async () => {
      const address = { line1: line1.trim(), city: city.trim(), state: state.trim(), zip: zip.trim(), country: us ? 'US' : country.trim() }
      await saveTaxProfile(
        us
          ? { form: 'w9', name: name.trim(), businessName: business.trim() || undefined, classification: klass, address, tin: tin.trim(), tinType, electronicConsent: consent }
          : { form: entity, name: name.trim(), country: country.trim(), address, foreignTin: tin.trim() || undefined, electronicConsent: consent },
      )
      onSaved()
    })

  return (
    <Panel gap="$4">
      <XStack gap="$2" role="group" aria-label="Form">
        <Act on={us} onPress={() => setForm('w9')}>
          W-9 · US person
        </Act>
        <Act on={!us} onPress={() => setForm('w8')}>
          W-8 · outside the US
        </Act>
      </XStack>
      <Fields>
        <Field label={us ? 'Legal name (as on your tax return)' : 'Legal name'} value={name} set={setName} name="name" />
        {us ? (
          <Field label="Business name (if different)" value={business} set={setBusiness} name="business" />
        ) : (
          <Choice
            label="Form"
            value={entity}
            set={setEntity}
            of={[
              { value: 'w8bene', label: 'W-8BEN-E · entity' },
              { value: 'w8ben', label: 'W-8BEN · individual' },
            ]}
          />
        )}
      </Fields>
      {us ? <Choice label="Federal tax classification" value={klass} set={setKlass} of={CLASSES} /> : null}
      <Fields>
        <Field label="Address" value={line1} set={setLine1} name="line1" />
        <Field label="City" value={city} set={setCity} name="city" />
      </Fields>
      <Fields>
        <Field label={us ? 'State' : 'Region'} value={state} set={setState} name="state" />
        <Field label={us ? 'ZIP' : 'Postal code'} value={zip} set={setZip} name="zip" />
        {us ? null : <Field label="Country" value={country} set={setCountry} name="country" />}
      </Fields>
      <Fields>
        {us ? (
          <Choice
            label="Taxpayer ID type"
            value={tinType}
            set={setTinType}
            of={[
              { value: 'ein', label: 'EIN' },
              { value: 'ssn', label: 'SSN' },
            ]}
          />
        ) : null}
        <Field
          label={us ? 'Taxpayer ID number' : 'Foreign tax ID (if any)'}
          value={tin}
          set={setTin}
          type="password"
          name="tin"
          help="Sent over TLS to api.hanzo.ai; the platform only ever shows it back masked."
        />
      </Fields>
      <Tick label="Send my tax forms electronically" checked={consent} set={setConsent} />
      <XStack>
        <Act loud disabled={!ready || busy} onPress={save}>
          Save tax form
        </Act>
      </XStack>
      <Refusal says={failed} />
    </Panel>
  )
}

function Payout({
  wallets: read,
  current,
  payoutLive,
  onSet,
  onMade,
}: {
  wallets: Read<{ wallets: Wallet[] }>
  current: string | null
  payoutLive: boolean
  onSet: () => void
  onMade: () => void
}) {
  const { busy, failed, status, run } = useRun()
  if (read.failed) return <Failed what="load your wallets" why={read.failed} />
  if (!read.it) return <Nothing says="Loading…" />
  const list = read.it.wallets

  return (
    <Panel>
      {list.length ? (
        list.map((w) => (
          <XStack key={w.id} items="center" gap="$3" flexWrap="wrap" py="$1">
            <Text fontSize="$3" color="$ink" flex={1}>
              {w.name} · {w.chain}
            </Text>
            <Text fontSize="$1" color="$quiet" fontFamily="$mono" numberOfLines={1}>
              {w.address}
            </Text>
            {current === w.id ? (
              <Mark tone="up" says="Payouts go here" />
            ) : (
              <Act disabled={busy || !payoutLive} onPress={() => void run(async () => (await setPayout(w.id), onSet()))}>
                Pay me here
              </Act>
            )}
          </XStack>
        ))
      ) : (
        <Text fontSize="$2" color="$soft">
          Your organization has no wallet yet.
        </Text>
      )}
      {!payoutLive ? (
        <Text fontSize="$1" color="$quiet">
          Choosing a payout wallet opens when /v1/principal is live; until then a listing names its wallet directly.
        </Text>
      ) : null}
      {!list.length ? (
        <XStack>
          <Act
            loud
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const account = await createAccount('Payouts')
                await createWallet({ accountId: account.id, name: 'Payouts', custody: 'mpc' })
                onMade()
              })
            }
          >
            Create a payout wallet
          </Act>
        </XStack>
      ) : null}
      {failed && notServed(status) ? <Pending what="Not live yet" says={failed} /> : <Refusal says={failed} />}
    </Panel>
  )
}
