import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { fetchPeers, safeHref, type FederatedMarket } from '../lib/federation'

export const Route = createFileRoute('/federation')({
  component: FederationPage,
})

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; peers: FederatedMarket[] }
  | { kind: 'error'; message: string }

function FederationPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchPeers()
      .then((peers) => {
        if (!cancelled) setState({ kind: 'ready', peers })
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        if (!cancelled) setState({ kind: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="section">
      <h1 className="section-title">Federation</h1>
      <p className="section-subtitle">
        Browse markets across federated peers. Each peer publishes its
        <code style={{ marginInline: 4 }}>/.well-known/market.json</code>
        descriptor per IETF RFC 8615.
      </p>

      {state.kind === 'loading' ? (
        <div className="loading-indicator">Loading federated markets…</div>
      ) : null}

      {state.kind === 'error' ? (
        <div className="card">
          <strong>Could not load local descriptor.</strong>
          <p style={{ margin: 0, color: 'var(--ink-soft)' }}>{state.message}</p>
        </div>
      ) : null}

      {state.kind === 'ready' && state.peers.length === 1 ? (
        <EmptyState peer={state.peers[0]!} />
      ) : null}

      {state.kind === 'ready' && state.peers.length >= 1 ? (
        <div className="federation-grid">
          {state.peers.map((peer) => (
            <PeerCard key={`${peer.brandId}:${peer.url}`} peer={peer} />
          ))}
        </div>
      ) : null}
    </main>
  )
}

function EmptyState({ peer }: { peer: FederatedMarket }) {
  return (
    <div
      className="card"
      style={{ marginBottom: 20, borderStyle: 'dashed' }}
    >
      <strong>No federated peers configured.</strong>
      <p style={{ margin: 0, color: 'var(--ink-soft)' }}>
        Showing this market ({peer.title}) only. Operators can add peers by mounting a
        ConfigMap that overrides
        <code style={{ marginInline: 4 }}>public/.well-known/market.json</code>
        with a populated <code>peers</code> array.
      </p>
    </div>
  )
}

function PeerCard({ peer }: { peer: FederatedMarket }) {
  const isOk = peer.status === 'ok'
  // CRITICAL: validate scheme on URLs from federated peers. A malicious peer
  // could serve `javascript:...` in its well-known JSON; rendering it raw is XSS.
  // rel="noreferrer" does NOT mitigate javascript: URLs.
  const visitHref = safeHref(peer.url)
  const skillsHref = visitHref ? safeHref(`${stripTrailingSlash(visitHref)}/skills`) : null
  const githubHref = safeHref(peer.github)

  return (
    <article className="card federation-card">
      <header className="federation-card-header">
        <h2 className="federation-card-title">{peer.title}</h2>
        <StatusBadge status={peer.status} />
      </header>

      <p className="federation-card-domain mono">{peer.domain}</p>

      {peer.chain ? (
        <div className="federation-card-chain">
          <span className="hero-badge">
            {peer.chain.name} <span className="mono">· chainId {peer.chain.id}</span>
          </span>
        </div>
      ) : null}

      {peer.capabilities.length > 0 ? (
        <ul className="federation-card-caps">
          {peer.capabilities.map((cap) => (
            <li key={cap} className="hero-badge">
              {cap}
            </li>
          ))}
        </ul>
      ) : null}

      {!isOk && peer.error ? (
        <p className="federation-card-error">
          <strong>Unreachable.</strong> {peer.error}
        </p>
      ) : null}

      <footer className="federation-card-footer">
        {visitHref ? (
          <a className="btn btn-primary" href={visitHref} target="_blank" rel="noreferrer noopener">
            Visit
          </a>
        ) : (
          <span className="federation-card-error">Invalid URL (non-http(s))</span>
        )}
        {skillsHref ? (
          <a className="btn" href={skillsHref} target="_blank" rel="noreferrer noopener">
            Browse skills
          </a>
        ) : null}
        {githubHref ? (
          <a className="btn" href={githubHref} target="_blank" rel="noreferrer noopener">
            Source
          </a>
        ) : null}
      </footer>
    </article>
  )
}

function StatusBadge({ status }: { status: FederatedMarket['status'] }) {
  const label = status === 'ok' ? 'online' : status === 'timeout' ? 'timeout' : 'error'
  return (
    <span
      className="federation-status"
      data-status={status}
      aria-label={`Peer status: ${label}`}
    >
      {label}
    </span>
  )
}

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}
