// What the org earned — its gross for the year, the x402 receipts paid to it per
// call and for jobs, what buyers have set aside for its open work — and the 1099s
// it received. A figure whose source has not answered is shown as pending, never
// as a zero.

import { useState, type ReactNode } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'

import { notServed, why } from '~/lib/http'
import { floor, JOBS, lead, RECEIPTS, setAside, split } from '~/lib/earnings'
import { words } from '~/lib/job'
import { jobs, seller, settlements, statementPdf, taxInbox, type Statement } from '~/lib/market'
import { cents, usd } from '~/lib/money'
import { useRead, type Read } from '~/lib/read'
import { Gate } from '~/gate'
import { SellNav } from '~/pages/setup'
import { useSession } from '~/session'
import { Act, Choice, Count, Failed, Mark, Nothing, Page, Pending, Refusal, Row, Section } from '~/ui'

export function Earnings() {
  return (
    <Gate why="Earnings and tax forms belong to your organization.">
      <Inner />
    </Gate>
  )
}

const YEARS = (() => {
  const now = new Date().getUTCFullYear()
  return [now, now - 1, now - 2].map(String)
})()

function Inner() {
  const session = useSession()
  const [year, setYear] = useState(YEARS[0])
  const standing = useRead(() => seller(Number(year)), [year, session.org])
  const paid = useRead(() => settlements('payee', Number(year)).then((r) => r.settlements), [year, session.org])
  const work = useRead(() => jobs('seller').then((r) => r.jobs), [session.org])
  const forms = useRead(() => taxInbox(Number(year)).then((r) => r.data), [year, session.org])

  return (
    <Page eyebrow="Sell" title="Earnings" says="Paid per call over x402, and for jobs when buyers release them." beside={<Choice label="Year" value={year} set={setYear} of={YEARS.map((y) => ({ value: y, label: y }))} />}>
      <SellNav />
      <XStack gap="$3" flexWrap="wrap">
        <Tile read={standing} says={`Earned in ${year}`} of={(s) => `${s.earnings.partial ? 'at least ' : ''}${usd(s.earnings.gross, s.earnings.currency)}`} />
        <Tile read={paid} says="Per call (x402)" of={(p) => `${floor(p, RECEIPTS)}${usd(split(p).perCall)}`} />
        <Tile read={paid} says="Paid for jobs" of={(p) => `${floor(p, RECEIPTS)}${usd(split(p).jobs)}`} />
        <Tile read={work} says="Set aside for your open jobs" of={(w) => `${floor(w, JOBS)}${usd(setAside(w))}`} />
      </XStack>

      <Section title="Settlements" says="Each x402 payment your organization received.">
        {notServed(paid.status) ? (
          <Pending what="Settlement history is not live yet" says="api.hanzo.ai does not answer GET /v1/x402/settlements yet; each receipt is readable by id meanwhile." />
        ) : paid.failed ? (
          <Failed what="load settlements" why={paid.failed} />
        ) : !paid.it ? (
          <Nothing says="Loading…" />
        ) : !paid.it.length ? (
          <Nothing says={`No x402 payments in ${year}.`} />
        ) : (
          <YStack>
            {floor(paid.it, RECEIPTS) ? (
              <Text fontSize="$2" color="$quiet" data-cut="">
                {`The newest ${paid.it.length.toLocaleString('en-US')} payments. The platform lists no more than that, so the figures above from them are floors.`}
              </Text>
            ) : null}
            {paid.it.map((r) => (
              <Row key={r.id}>
                <Text fontSize="$2" color="$ink" flex={1} numberOfLines={1}>
                  {r.resource}
                </Text>
                <Text fontSize="$2" color="$soft">
                  {r.payer}
                </Text>
                <Text fontSize="$2" color="$ink">
                  {usd(r.amount)}
                </Text>
                <Mark tone="up" says={r.settledVia === 'chain' ? 'On chain' : 'Ledger'} />
              </Row>
            ))}
          </YStack>
        )}
      </Section>

      <Section title="Jobs" says="Work you were hired for.">
        {notServed(work.status) ? (
          <Pending what="Jobs are not live yet" says="api.hanzo.ai does not answer GET /v1/marketplace/jobs yet." />
        ) : work.failed ? (
          <Failed what="load jobs" why={work.failed} />
        ) : !work.it ? (
          <Nothing says="Loading…" />
        ) : !work.it.length ? (
          <Nothing says="No jobs yet." />
        ) : (
          <YStack>
            {work.it.map((j) => (
              <Row key={j.id}>
                <Text fontSize="$2" color="$ink" flex={1} numberOfLines={1}>
                  {j.title}
                </Text>
                <Text fontSize="$2" color="$ink">
                  {usd(j.amount, j.currency)}
                </Text>
                <Mark tone={j.status === 'released' ? 'up' : j.status === 'disputed' ? 'act' : 'moving'} says={words(j).split(' — ')[0]} />
              </Row>
            ))}
          </YStack>
        )}
      </Section>

      <Section title="Tax forms you received" says="1099s other organizations furnished to yours.">
        <Forms read={forms} year={year} />
      </Section>
    </Page>
  )
}

/** One figure, drawn only once its source answered; until then it says why it has none. */
function Tile<T>({ read, says, of }: { read: Read<T>; says: string; of: (it: T) => ReactNode }) {
  if (read.it !== null) return <Count of={of(read.it)} says={says} />
  const state = notServed(read.status) ? 'not live yet' : read.failed ? 'unavailable' : 'loading'
  return (
    <YStack flex={1} minW={160} data-pending="">
      <Count of="—" says={`${says} · ${state}`} />
    </YStack>
  )
}

function Forms({ read, year }: { read: { it: Statement[] | null; failed: string | null }; year: string }) {
  const [refused, setRefused] = useState<string | null>(null)
  if (read.failed) return <Failed what="load your 1099s" why={read.failed} />
  if (!read.it) return <Nothing says="Loading…" />
  if (!read.it.length) return <Nothing says={`No 1099s for ${year}.`} />

  const open = async (s: Statement) => {
    setRefused(null)
    try {
      const pdf = await statementPdf(s.id)
      window.open(URL.createObjectURL(pdf), '_blank', 'noopener')
    } catch (e) {
      setRefused(why(e))
    }
  }

  return (
    <YStack>
      {read.it.map((s) => (
        <Row key={s.id}>
          <Text fontSize="$2" color="$ink" flex={1} numberOfLines={1}>
            {s.kind} · {s.payer.businessName || s.payer.name}
            {s.corrected ? ' · corrected' : ''}
          </Text>
          <Text fontSize="$2" color="$soft">
            {lead(s)?.label ?? ''}
          </Text>
          <Text fontSize="$2" color="$ink">
            {cents(lead(s)?.cents ?? 0)}
          </Text>
          {s.backup.required ? <Mark tone="act" says="Backup withholding" /> : null}
          <Act onPress={() => void open(s)} label={`Download ${s.kind} from ${s.payer.name}`}>
            PDF
          </Act>
        </Row>
      ))}
      <Refusal says={refused} />
    </YStack>
  )
}
