// One read: its answer, its refusal, and a way to ask again. Re-runs when `deps`
// change — including the org, so a switch of tenant re-reads every screen.

import { useCallback, useEffect, useState } from 'react'

import { Refusal, why } from '~/lib/http'

export interface Read<T> {
  /** Null until the first answer. */
  it: T | null
  /** The refusal's sentence, or null. */
  failed: string | null
  /** The refusal's HTTP status, or null. */
  status: number | null
  loading: boolean
  again: () => void
}

export function useRead<T>(get: (() => Promise<T>) | null, deps: unknown[]): Read<T> {
  const [it, setIt] = useState<T | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [status, setStatus] = useState<number | null>(null)
  const [loading, setLoading] = useState(Boolean(get))
  const [turn, setTurn] = useState(0)
  const run = useCallback(get ?? (() => Promise.resolve(null as T)), deps)
  const on = Boolean(get)

  useEffect(() => {
    let live = true
    if (!on) {
      setLoading(false)
      return () => {
        live = false
      }
    }
    setLoading(true)
    setFailed(null)
    setStatus(null)
    run()
      .then((got) => {
        if (!live) return
        setIt(got)
      })
      .catch((e: unknown) => {
        if (!live) return
        setFailed(why(e))
        setStatus(e instanceof Refusal ? e.status : null)
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [run, turn, on])

  return { it, failed, status, loading, again: () => setTurn((t) => t + 1) }
}

/** A write in flight: one at a time, and the platform's refusal if it said no. */
export function useRun() {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [status, setStatus] = useState<number | null>(null)
  const run = async <T,>(go: () => Promise<T>): Promise<T | undefined> => {
    if (busy) return undefined
    setBusy(true)
    setFailed(null)
    setStatus(null)
    try {
      return await go()
    } catch (e) {
      setFailed(why(e))
      setStatus(e instanceof Refusal ? e.status : null)
      return undefined
    } finally {
      setBusy(false)
    }
  }
  return { busy, failed, status, run }
}
