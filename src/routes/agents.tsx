import { createFileRoute } from '@tanstack/react-router'
import { Bot, Loader2, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { agentsApi, ApiError, type CloudAgent } from '../lib/api'
import { useAuthContext } from '../lib/AuthContext'

export const Route = createFileRoute('/agents')({
  component: AgentsPage,
})

type Turn = { role: 'you' | 'agent'; text: string }

const COLORS = {
  bg: '#000',
  panel: '#0a0a0a',
  border: '#262626',
  text: '#fafafa',
  muted: '#a3a3a3',
  accent: '#e4e4e7',
}

function AgentsPage() {
  const { user: me, signIn } = useAuthContext()

  if (!me) {
    return (
      <main style={{ background: COLORS.bg, color: COLORS.text, minHeight: '70vh', padding: '4rem 1.5rem' }}>
        <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
          <Bot size={32} style={{ color: COLORS.muted, marginBottom: 16 }} aria-hidden="true" />
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px' }}>Cloud Agents</h1>
          <p style={{ color: COLORS.muted, margin: '0 0 20px' }}>
            Sign in to chat with your organization&rsquo;s agents.
          </p>
          <button type="button" onClick={signIn} style={primaryBtn}>
            Sign in
          </button>
        </div>
      </main>
    )
  }

  return <AgentsConsole />
}

function AgentsConsole() {
  const [agents, setAgents] = useState<CloudAgent[] | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<CloudAgent | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    agentsApi
      .list()
      .then((r) => {
        setAgents(r.agents)
        setSelected((prev) => prev ?? r.agents[0] ?? null)
      })
      .catch((e) => {
        setAgents([])
        setLoadError(e instanceof ApiError ? e.message : 'Failed to load agents')
      })
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [turns, running])

  function pick(agent: CloudAgent) {
    setSelected(agent)
    setTurns([])
  }

  async function send() {
    const text = input.trim()
    if (!text || !selected || running) return
    setInput('')
    setTurns((t) => [...t, { role: 'you', text }])
    setRunning(true)
    try {
      const res = await agentsApi.run(selected.name, text)
      setTurns((t) => [...t, { role: 'agent', text: res.output }])
    } catch (e) {
      const msg = e instanceof ApiError ? `Error ${e.status}: ${e.message}` : 'Run failed'
      setTurns((t) => [...t, { role: 'agent', text: msg }])
    } finally {
      setRunning(false)
    }
  }

  return (
    <main style={{ background: COLORS.bg, color: COLORS.text, minHeight: '80vh' }}>
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '2rem 1.5rem',
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 280px) 1fr',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* ─── Agent list ─── */}
        <aside style={{ ...panel, padding: 8 }}>
          <div style={{ padding: '8px 8px 12px', color: COLORS.muted, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Cloud Agents
          </div>
          {agents === undefined ? (
            <div style={{ padding: 12, color: COLORS.muted }}>Loading&hellip;</div>
          ) : agents.length === 0 ? (
            <div style={{ padding: 12, color: COLORS.muted, fontSize: 14 }}>
              {loadError ?? 'No agents in this organization yet.'}
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {agents.map((a) => {
                const active = selected?.name === a.name
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => pick(a)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: active ? '#161616' : 'transparent',
                        border: `1px solid ${active ? COLORS.border : 'transparent'}`,
                        borderRadius: 8,
                        color: COLORS.text,
                        padding: '10px 12px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                      <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>{a.model}</div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {/* ─── Conversation ─── */}
        <section style={{ ...panel, display: 'flex', flexDirection: 'column', height: '70vh' }}>
          <header style={{ borderBottom: `1px solid ${COLORS.border}`, padding: '14px 16px' }}>
            <div style={{ fontWeight: 600 }}>{selected ? selected.name : 'Select an agent'}</div>
            {selected?.description ? (
              <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 2 }}>{selected.description}</div>
            ) : null}
          </header>

          <div ref={logRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {turns.length === 0 ? (
              <div style={{ color: COLORS.muted, fontSize: 14, margin: 'auto', textAlign: 'center' }}>
                {selected ? `Message ${selected.name} to start.` : 'Pick an agent on the left.'}
              </div>
            ) : (
              turns.map((t, i) => <Bubble key={i} turn={t} />)
            )}
            {running ? (
              <div style={{ color: COLORS.muted, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={14} className="animate-spin" aria-hidden="true" /> thinking&hellip;
              </div>
            ) : null}
          </div>

          <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: 12, display: 'flex', gap: 8 }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              placeholder={selected ? 'Message the agent…' : 'Select an agent first'}
              disabled={!selected || running}
              rows={2}
              style={{
                flex: 1,
                resize: 'none',
                background: COLORS.bg,
                color: COLORS.text,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: '10px 12px',
                fontFamily: 'inherit',
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!selected || running || !input.trim()}
              style={{ ...primaryBtn, alignSelf: 'stretch', opacity: !selected || running || !input.trim() ? 0.5 : 1 }}
              aria-label="Send"
            >
              <Send size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

function Bubble({ turn }: { turn: Turn }) {
  const you = turn.role === 'you'
  return (
    <div style={{ display: 'flex', justifyContent: you ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '80%',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: you ? '#161616' : 'transparent',
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: '10px 14px',
          fontSize: 14,
          lineHeight: 1.5,
          color: you ? COLORS.text : COLORS.accent,
        }}
      >
        {turn.text}
      </div>
    </div>
  )
}

const panel: React.CSSProperties = {
  background: COLORS.panel,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 12,
}

const primaryBtn: React.CSSProperties = {
  background: COLORS.text,
  color: COLORS.bg,
  border: 'none',
  borderRadius: 999,
  padding: '10px 18px',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
}
