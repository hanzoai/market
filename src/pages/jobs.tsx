// Escrowed jobs: the buyer's hires and the seller's inbox, and one job's
// lifecycle — open → accepted → delivered → released or disputed.

import { useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'
import { Link, useParams } from 'react-router'

import { web } from '~/lib/api'
import { notServed } from '~/lib/http'
import { acts, side, stages, WORDS } from '~/lib/job'
import { actOnJob, job as getJob, jobs, type Job, type JobAct } from '~/lib/market'
import { usd } from '~/lib/money'
import { useRead, useRun } from '~/lib/read'
import { Gate } from '~/gate'
import { SellNav } from '~/pages/setup'
import { useSession } from '~/session'
import { Act, Failed, Field, List, Mark, Nothing, Page, Panel, Pending, Refusal, Row, Section, Stages, Words } from '~/ui'

const tone = (s: Job['status']) => (s === 'released' ? 'up' : s === 'disputed' ? 'act' : s === 'open' ? 'quiet' : 'moving')

export function Jobs({ role }: { role: 'buyer' | 'seller' }) {
  return (
    <Gate why={role === 'seller' ? 'Your jobs inbox belongs to your organization.' : 'Your hires belong to your organization.'}>
      <JobList role={role} />
    </Gate>
  )
}

function JobList({ role }: { role: 'buyer' | 'seller' }) {
  const session = useSession()
  const read = useRead(() => jobs(role).then((r) => r.jobs), [role, session.org])
  return (
    <Page
      eyebrow={role === 'seller' ? 'Sell' : 'Buy'}
      title={role === 'seller' ? 'Jobs inbox' : 'Your jobs'}
      says={
        role === 'seller'
          ? 'Work buyers have funded into escrow. Accept a job, deliver it, and you are paid when the buyer releases.'
          : 'Agents you hired. Release the escrow when the work is delivered, or open a dispute.'
      }
    >
      {role === 'seller' ? <SellNav /> : null}
      {notServed(read.status) ? (
        <Pending what="Jobs are not live yet" says="api.hanzo.ai does not answer GET /v1/marketplace/jobs yet." />
      ) : (
        <List read={read} what="jobs" none={role === 'seller' ? 'No jobs yet.' : 'You have not hired anyone yet.'}>
          {(rows) =>
            rows.map((j) => (
              <Link key={j.id} to={`/jobs/${encodeURIComponent(j.id)}`} style={{ textDecoration: 'none' }}>
                <Row>
                  <Text fontSize="$3" color="$ink" flex={1} numberOfLines={1}>
                    {j.title}
                  </Text>
                  <Text fontSize="$2" color="$soft">
                    {role === 'seller' ? j.buyerOrg : j.sellerOrg}
                  </Text>
                  <Text fontSize="$2" color="$ink">
                    {usd(j.amount, j.currency)}
                  </Text>
                  <Mark tone={tone(j.status)} says={j.status} />
                </Row>
              </Link>
            ))
          }
        </List>
      )}
    </Page>
  )
}

export function JobPage() {
  return (
    <Gate why="A job is between two organizations; sign in as one of them to see it.">
      <One />
    </Gate>
  )
}

function One() {
  const { id = '' } = useParams()
  const read = useRead(() => getJob(id), [id])
  const [fresh, setFresh] = useState<Job | null>(null)
  const j = fresh ?? read.it

  if (read.failed) {
    return (
      <Page title="Job">
        {notServed(read.status) ? (
          <Pending what="Jobs are not live yet" says={read.failed} />
        ) : (
          <Failed what="load this job" why={read.failed} />
        )}
      </Page>
    )
  }
  if (!j) return <Nothing says="Loading…" />
  return <Shown j={j} onChange={setFresh} />
}

function Shown({ j, onChange }: { j: Job; onChange: (j: Job) => void }) {
  const session = useSession()
  const role = side(j, session.org)
  const can = role ? acts(j, role) : []

  return (
    <Page eyebrow="Escrow job" title={j.title} says={WORDS[j.status]}>
      <Stages of={stages(j.status)} />
      <XStack gap="$6" flexWrap="wrap" items="flex-start">
        <YStack gap="$4" flex={2} minW={300}>
          <Section title="Brief">
            <Text fontSize="$3" color="$ink" whiteSpace="pre-wrap">
              {j.brief}
            </Text>
          </Section>
          {j.delivery ? (
            <Section title="Delivery">
              <Text fontSize="$3" color="$ink" whiteSpace="pre-wrap">
                {j.delivery.note}
              </Text>
              {web(j.delivery.url) ? (
                <a href={web(j.delivery.url)!} target="_blank" rel="noopener noreferrer">
                  <Text fontSize="$2" color="$ink" textDecorationLine="underline">
                    {j.delivery.url}
                  </Text>
                </a>
              ) : null}
            </Section>
          ) : null}
          {j.dispute ? (
            <Section title="Dispute">
              <Text fontSize="$3" color="$ink">
                {j.dispute.reason}
              </Text>
            </Section>
          ) : null}
          {can.length ? <Actions j={j} can={can} onChange={onChange} /> : null}
        </YStack>
        <YStack gap="$4" flex={1} minW={280}>
          <Panel gap="$2">
            <Fact k="Amount" v={usd(j.amount, j.currency)} />
            <Fact k="Buyer" v={j.buyerOrg} />
            <Fact k="Seller" v={j.sellerOrg} />
            <Fact k="You are" v={role ?? 'not a party'} />
          </Panel>
          <Panel gap="$2">
            <Text fontSize="$2" color="$soft">
              Escrow
            </Text>
            <Fact k="Network" v={j.escrow.network} />
            <Fact k="Contract" v={j.escrow.contract} />
            {j.escrow.txHash ? <Fact k="Funding tx" v={j.escrow.txHash} /> : null}
          </Panel>
          <Panel gap="$2">
            <Text fontSize="$2" color="$soft">
              History
            </Text>
            {j.history.map((h) => (
              <XStack key={`${h.status}-${h.at}`} justify="space-between" gap="$2">
                <Text fontSize="$2" color="$ink">
                  {h.status}
                </Text>
                <Text fontSize="$1" color="$quiet">
                  {new Date(h.at * 1000).toISOString().replace('T', ' ').slice(0, 16)}
                </Text>
              </XStack>
            ))}
          </Panel>
        </YStack>
      </XStack>
    </Page>
  )
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <XStack justify="space-between" gap="$3">
      <Text fontSize="$2" color="$quiet">
        {k}
      </Text>
      <Text fontSize="$2" color="$ink" numberOfLines={1}>
        {v}
      </Text>
    </XStack>
  )
}

const LABELS: Record<JobAct, string> = {
  accept: 'Accept the job',
  deliver: 'Mark delivered',
  release: 'Release payment',
  dispute: 'Open a dispute',
}

function Actions({ j, can, onChange }: { j: Job; can: JobAct[]; onChange: (j: Job) => void }) {
  const { busy, failed, run } = useRun()
  const [note, setNote] = useState('')
  const [link, setLink] = useState('')
  const [reason, setReason] = useState('')

  const act = (a: JobAct) =>
    void run(async () => {
      const body = a === 'deliver' ? { note: note.trim(), url: link.trim() || undefined } : a === 'dispute' ? { reason: reason.trim() } : undefined
      onChange(await actOnJob(j.id, a, body))
    })

  return (
    <Section title="Next">
      <Panel>
        {can.includes('deliver') ? (
          <>
            <Words label="What you delivered" value={note} set={setNote} hint="Summarize the work." />
            <Field label="Link (optional)" value={link} set={setLink} hint="https://…" />
          </>
        ) : null}
        {can.includes('dispute') ? (
          <Words label="Reason for a dispute (only if you open one)" value={reason} set={setReason} rows={2} />
        ) : null}
        <XStack gap="$2" flexWrap="wrap">
          {can.map((a) => (
            <Act
              key={a}
              loud={a !== 'dispute'}
              disabled={busy || (a === 'deliver' && !note.trim()) || (a === 'dispute' && !reason.trim())}
              onPress={() => act(a)}
            >
              {LABELS[a]}
            </Act>
          ))}
        </XStack>
        <Refusal says={failed} />
      </Panel>
    </Section>
  )
}
