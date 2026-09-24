// What the org earned — x402 settlements paid to it and escrow released to it —
// and the 1099s it received.

import { useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'

import { notServed, why } from '~/lib/http'
import { lead, totals } from '~/lib/earnings'
import { jobs, settlements, statementPdf, taxInbox, type Statement } from '~/lib/market'
import { cents, usd } from '~/lib/money'
import { useRead } from '~/lib/read'
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
  const paid = useRead(() => settlements('payee', Number(year)).then((r) => r.settlements), [year, session.org])
  const work = useRead(() => jobs('seller').then((r) => r.jobs), [session.org])
  const forms = useRead(() => taxInbox(Number(year)).then((r) => r.data), [year, session.org])
  const t = totals(paid.it ?? [], work.it ?? [], Number(year))

  return (
    <Page eyebrow="Sell" title="Earnings" says="Paid per call over x402, and by escrow when buyers release a job." beside={<Choice label="Year" value={year} set={setYear} of={YEARS.map((y) => ({ value: y, label: y }))} />}>
      <SellNav />
      <XStack gap="$3" flexWrap="wrap">
        <Count of={usd(t.all)} says={`Earned in ${year}`} />
        <Count of={usd(t.x402)} says="Per call (x402)" />
        <Count of={usd(t.escrow)} says="Released from escrow" />
        <Count of={usd(t.held)} says="Held in escrow" />
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

      <Section title="Escrow" says="Jobs you were hired for.">
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
                <Mark tone={j.status === 'released' ? 'up' : j.status === 'disputed' ? 'act' : 'moving'} says={j.status} />
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
