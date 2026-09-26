// Seller onboarding. The org is the economic principal: it is verified, it files
// the tax form, it proves the payout wallet it is paid into, and it receives the
// 1099s. Every read here is the acting org's: switching org re-reads them all,
// and nothing one org answered is ever shown as another's.

import { useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'
import { NavLink } from 'react-router'

import { web } from '~/lib/api'
import { notServed } from '~/lib/http'
import { todos } from '~/lib/clearance'
import {
  bindPayout,
  certifyTax,
  createAccount,
  createWallet,
  principal,
  saveTaxProfile,
  seller,
  startKyc,
  taxProfile,
  wallets,
  type Classification,
  type Onboarding,
  type Principal,
  type TaxForm,
  type TaxProfile,
  type Wallet,
} from '~/lib/market'
import { useRead, useRun, type Read } from '~/lib/read'
import { HANZO, onHanzo } from '~/lib/x402'
import { Gate } from '~/gate'
import { useSession } from '~/session'
import { Act, Choice, Failed, Field, Fields, Go, Mark, Nothing, Page, Panel, Pending, Refusal, Section, Stages, Tick } from '~/ui'

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
  const standing = useRead(() => seller(), [session.org])

  const identity = who.it?.identity.status ?? (notServed(who.status) ? 'not live' : '…')
  const form = who.it?.tax ?? (tax.it ? { valid: tax.it.valid, certified: tax.it.certification.status === 'certified' } : null)
  const taxState = form ? (form.valid ? 'valid' : form.certified ? 'certified' : 'on file') : notServed(tax.status) ? 'none' : '…'
  const bound = standing.it?.payout.bound ?? false

  return (
    <Page
      eyebrow="Sell"
      title="Set up your organization"
      says="Your organization is the seller: it is verified once, files one tax form, and is paid into its own wallet. The same setup clears larger purchases."
    >
      <SellNav />
      <Stages
        of={[
          { label: 'Signed in', stage: 'done' },
          { label: `Identity: ${identity}`, stage: identity === 'verified' || identity === 'reviewer_confirmed' ? 'done' : 'current' },
          { label: `Tax form: ${taxState}`, stage: form?.valid ? 'done' : 'current' },
          { label: bound ? 'Payout wallet: proved' : 'Payout wallet', stage: bound ? 'done' : 'todo' },
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
          <Owed read={who} />
        </Panel>
      </Section>

      <Section title="Identity" says="Buyers and the platform need to know who is being paid. Each founder verifies once.">
        <Identity read={who} />
      </Section>

      <Section title="Tax form" says="A W-9 if your organization is a US person, a W-8 if it is not. The 1099s and 1042-Ss you receive are built from it.">
        <Tax read={tax} onSaved={who.again} />
      </Section>

      <Section title="Payout wallet" says="Sales settle into a wallet your organization holds: per call over x402, and for a job when the buyer releases it. The wallet signs once to prove it is yours; jobs are paid into it.">
        <Payout org={session.org ?? ''} wallets={mine} standing={standing} />
      </Section>
    </Page>
  )
}

/** What the platform says the org still lacks, in its own words. */
function Owed({ read }: { read: Read<Principal> }) {
  if (notServed(read.status)) {
    return (
      <Pending
        what="Principal status is not live yet"
        says="api.hanzo.ai does not answer GET /v1/principal yet. What your organization still lacks to be paid appears here as soon as it does."
      />
    )
  }
  if (read.failed) return <Failed what="load your organization" why={read.failed} />
  if (!read.it) return null
  const owed = todos(read.it.compliance.missing)
  if (read.it.compliance.ready || !owed.length) return <Mark tone="up" says="Ready to pay and be paid" />
  return (
    <YStack gap="$2" data-owed="">
      {owed.map((t) => (
        <XStack key={t.body} gap="$2" items="flex-start">
          <Mark tone="act" says={t.title} />
          <Text fontSize="$2" color="$soft" flex={1}>
            {t.body}
          </Text>
        </XStack>
      ))}
    </YStack>
  )
}

function Identity({ read }: { read: Read<Principal> }) {
  const { busy, failed, status, run } = useRun()
  const [links, setLinks] = useState<{ email: string; verifyUrl: string }[]>([])
  const verified = read.it && (read.it.identity.status === 'verified' || read.it.identity.status === 'reviewer_confirmed')
  if (read.failed && !notServed(read.status)) return <Failed what="load your organization" why={read.failed} />
  return (
    <Panel>
      {read.it ? (
        <Mark tone={verified ? 'up' : 'quiet'} says={`Status: ${read.it.identity.status}`} />
      ) : null}
      {read.it && !verified && read.it.identity.reason ? (
        <Text fontSize="$2" color="$soft">
          {read.it.identity.reason}
        </Text>
      ) : null}
      {verified ? (
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
                const out = await startKyc()
                const open = out.sessions.flatMap((x) => {
                  const to = web(x.verifyUrl)
                  return to ? [{ email: x.email, verifyUrl: to }] : []
                })
                if (!open.length) throw new Error('The platform opened no verification session.')
                setLinks(open)
                read.again()
              })
            }
          >
            Verify your organization
          </Act>
        </XStack>
      )}
      {links.map((l) => (
        <XStack key={l.email} items="center" gap="$3" flexWrap="wrap" data-verify="">
          <Text fontSize="$2" color="$ink" flex={1}>
            {l.email}
          </Text>
          <Go to={l.verifyUrl}>Open verification</Go>
        </XStack>
      ))}
      {failed && notServed(status) ? (
        <Pending what="Identity verification is not live yet" says="api.hanzo.ai does not answer POST /v1/company/kyc yet." />
      ) : (
        <Refusal says={failed} />
      )}
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

/** W-8BEN-E line 4 (the common ones; cloud apps/tax/w8.go holds the full list). */
const CHAPTER3 = [
  { value: 'corporation', label: 'Corporation' },
  { value: 'partnership', label: 'Partnership (hybrid, claiming treaty benefits)' },
  { value: 'disregarded', label: 'Disregarded entity (hybrid, claiming treaty benefits)' },
  { value: 'complex_trust', label: 'Complex trust' },
  { value: 'estate', label: 'Estate' },
  { value: 'tax_exempt', label: 'Tax-exempt organization' },
  { value: 'private_foundation', label: 'Private foundation' },
]

/** W-8BEN-E line 5, the FATCA status (the common ones). */
const CHAPTER4 = [
  { value: 'active_nffe', label: 'Active NFFE' },
  { value: 'passive_nffe', label: 'Passive NFFE' },
  { value: 'publicly_traded_nffe', label: 'Publicly traded NFFE' },
  { value: 'excepted_startup', label: 'Excepted nonfinancial start-up company' },
  { value: 'nonprofit', label: 'Nonprofit organization' },
  { value: 'participating_ffi', label: 'Participating FFI' },
]

const LABEL: Record<TaxForm, string> = { w9: 'W-9', w8ben: 'W-8BEN', w8bene: 'W-8BEN-E' }

function Tax({ read, onSaved }: { read: Read<TaxProfile>; onSaved: () => void }) {
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
        <Mark tone={p.valid ? 'up' : 'quiet'} says={`${LABEL[p.form ?? 'w9']} · ${status}${p.valid ? ' · valid' : ''}`} />
        <Text fontSize="$2" color="$soft">
          {p.businessName || p.name}
          {p.tin ? ` · TIN ${p.tin}` : ''}
          {p.foreignTin ? ` · foreign TIN ${p.foreignTin}` : ''}
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          {status !== 'certified' ? (
            <Act loud disabled={busy} onPress={() => void run(async () => (await certifyTax(), read.again(), onSaved()))}>
              Sign and certify
            </Act>
          ) : null}
          <Act onPress={() => setEditing(true)}>Edit</Act>
        </XStack>
        <Refusal says={failed} />
      </Panel>
    )
  }
  return <TaxForm onSaved={() => (setEditing(false), read.again(), onSaved())} />
}

function TaxForm({ onSaved }: { onSaved: () => void }) {
  const { busy, failed, run } = useRun()
  const [us, setUs] = useState(true)
  const [name, setName] = useState('')
  const [business, setBusiness] = useState('')
  const [klass, setKlass] = useState<Classification>('c_corp')
  const [line1, setLine1] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [residence, setResidence] = useState('')
  const [tinType, setTinType] = useState<'ein' | 'ssn'>('ein')
  const [tin, setTin] = useState('')
  const [entity, setEntity] = useState<'w8ben' | 'w8bene'>('w8bene')
  const [citizen, setCitizen] = useState('')
  const [birth, setBirth] = useState('')
  const [chapter3, setChapter3] = useState('corporation')
  const [chapter4, setChapter4] = useState('active_nffe')
  const [capacity, setCapacity] = useState('')
  const [consent, setConsent] = useState(true)

  const code2 = (v: string) => /^[A-Za-z]{2}$/.test(v.trim())
  const ready = us
    ? name.trim() && line1.trim() && city.trim() && code2(state) && /^\d{5}(\d{4})?$/.test(zip.replace(/\D/g, '')) && tin.trim()
    : name.trim() && line1.trim() && city.trim() && code2(residence) && code2(citizen) && (entity === 'w8ben' || capacity.trim())

  const save = () =>
    void run(async () => {
      const address = {
        line1: line1.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        zip: us ? zip.replace(/\D/g, '') : zip.trim(),
        country: us ? 'US' : residence.trim().toUpperCase(),
      }
      await saveTaxProfile(
        us
          ? { form: 'w9', name: name.trim(), businessName: business.trim() || undefined, classification: klass, address, tin: tin.trim(), tinType: klass === 'individual' ? tinType : 'ein', electronicConsent: consent }
          : {
              form: entity,
              name: name.trim(),
              address,
              foreignTin: tin.trim() || undefined,
              w8: {
                country: citizen.trim().toUpperCase(),
                noForeignTin: tin.trim() ? undefined : true,
                ...(entity === 'w8ben' ? { birth: birth.trim() || undefined } : { chapter3, chapter4, capacity: capacity.trim() }),
              },
              electronicConsent: consent,
            },
      )
      onSaved()
    })

  return (
    <Panel gap="$4">
      <XStack gap="$2" role="group" aria-label="Form">
        <Act on={us} onPress={() => setUs(true)}>
          W-9 · US person
        </Act>
        <Act on={!us} onPress={() => setUs(false)}>
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
      {!us ? (
        <Fields>
          <Field
            label={entity === 'w8ben' ? 'Country of citizenship (2 letters)' : 'Country of incorporation (2 letters)'}
            value={citizen}
            set={setCitizen}
            hint="DE"
            name="citizen"
          />
          {entity === 'w8ben' ? (
            <Field label="Date of birth" value={birth} set={setBirth} hint="YYYY-MM-DD" name="birth" />
          ) : (
            <Field label="Signed by, in the capacity of" value={capacity} set={setCapacity} hint="Director" name="capacity" />
          )}
        </Fields>
      ) : null}
      {!us && entity === 'w8bene' ? (
        <Fields>
          <Choice label="Chapter 3 status (line 4)" value={chapter3} set={setChapter3} of={CHAPTER3} />
          <Choice label="FATCA status (line 5)" value={chapter4} set={setChapter4} of={CHAPTER4} />
        </Fields>
      ) : null}
      <Fields>
        <Field label={us ? 'Address' : 'Permanent residence address'} value={line1} set={setLine1} name="line1" />
        <Field label="City" value={city} set={setCity} name="city" />
      </Fields>
      <Fields>
        <Field label={us ? 'State (2 letters)' : 'Region'} value={state} set={setState} name="state" />
        <Field label={us ? 'ZIP' : 'Postal code'} value={zip} set={setZip} name="zip" />
        {us ? null : <Field label="Country of residence (2 letters)" value={residence} set={setResidence} hint="DE" name="residence" />}
      </Fields>
      <Fields>
        {us && klass === 'individual' ? (
          <Choice
            label="Taxpayer ID type"
            value={tinType}
            set={setTinType}
            of={[
              { value: 'ssn', label: 'SSN' },
              { value: 'ein', label: 'EIN' },
            ]}
          />
        ) : null}
        <Field
          label={us ? (klass === 'individual' ? 'Taxpayer ID number' : 'EIN') : 'Foreign tax ID (leave empty if your country issues none)'}
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

function Payout({ org, wallets: read, standing }: { org: string; wallets: Read<{ wallets: Wallet[] }>; standing: Read<Onboarding> }) {
  const { busy, failed, status, run } = useRun()
  if (read.failed) return <Failed what="load your wallets" why={read.failed} />
  if (!read.it) return <Nothing says="Loading…" />
  const list = read.it.wallets
  const payout = standing.it?.payout ?? null
  // A hire is paid on the Hanzo L1, so an org with no wallet there is offered one.
  const hanzo = list.some((w) => onHanzo(w.chain))

  return (
    <Panel>
      {notServed(standing.status) ? (
        <Pending what="Payout binding is not live yet" says="api.hanzo.ai does not answer GET /v1/marketplace/seller yet." />
      ) : standing.failed ? (
        <Failed what="load where your organization stands as a seller" why={standing.failed} />
      ) : null}
      {list.map((w) => (
        <XStack key={w.id} items="center" gap="$3" flexWrap="wrap" py="$1" data-wallet="">
          <Text fontSize="$3" color="$ink" flex={1}>
            {w.name} · {w.chain || 'any chain'}
          </Text>
          <Text fontSize="$1" color="$quiet" fontFamily="$mono" numberOfLines={1}>
            {w.address}
          </Text>
          {payout?.bound && payout.wallet === w.id ? (
            <Mark tone="up" says="Payouts go here" />
          ) : payout ? (
            <Act disabled={busy} onPress={() => void run(async () => (await bindPayout(org, w), standing.again()))} label={`Use ${w.name} for payouts`}>
              Use for payouts
            </Act>
          ) : null}
        </XStack>
      ))}
      {hanzo ? null : (
        <>
          <Text fontSize="$2" color="$soft">
            {list.length ? 'None of your organization’s wallets is on the Hanzo L1, where hires are paid.' : 'Your organization has no wallet yet.'}
          </Text>
          <XStack>
            <Act
              loud
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  const account = await createAccount('Payouts')
                  await createWallet({ accountId: account.id, name: 'Payouts', custody: 'mpc', chain: HANZO })
                  read.again()
                })
              }
            >
              Create a payout wallet
            </Act>
          </XStack>
        </>
      )}
      {failed && notServed(status) ? <Pending what="Not live yet" says={failed} /> : <Refusal says={failed} />}
    </Panel>
  )
}
