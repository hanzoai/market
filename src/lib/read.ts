// One read: its answer, its refusal, and a way to ask again. Re-runs when `deps`
// change — including the org, so a switch of tenant re-reads every screen.
//
// An answer belongs to the inputs that asked for it. When the inputs change, the
// previous answer is gone at once (never shown for the new ones), and a refusal
// leaves no answer behind: a screen never reads one org's record as another's,
// or a clearance for one amount as the clearance for another.

import { useCallback, useEffect, useState } from 'react'

import { Refusal, why } from '~/lib/http'

export interface Read<T> {
  /** The answer for the current inputs; null while they are asked, or when they were refused. */
  it: T | null
  /** The refusal's sentence, or null. */
  failed: string | null
  /** The refusal's HTTP status, or null. */
  status: number | null
  loading: boolean
  again: () => void
}

interface Answer<T> {
  /** The read this answers: `run` for the inputs that asked. */
  of: unknown
  it: T | null
  failed: string | null
  status: number | null
}

export function useRead<T>(get: (() => Promise<T>) | null, deps: unknown[]): Read<T> {
  const [answer, setAnswer] = useState<Answer<T> | null>(null)
  const [asking, setAsking] = useState(false)
  const [turn, setTurn] = useState(0)
  const run = useCallback(get ?? (() => Promise.resolve(null as T)), deps)
  const on = Boolean(get)

  useEffect(() => {
    if (!on) return
    let live = true
    setAsking(true)
    run()
      .then((got) => {
        if (live) setAnswer({ of: run, it: got, failed: null, status: null })
      })
      .catch((e: unknown) => {
        if (live) setAnswer({ of: run, it: null, failed: why(e), status: e instanceof Refusal ? e.status : null })
      })
      .finally(() => {
        if (live) setAsking(false)
      })
    return () => {
      live = false
    }
  }, [run, turn, on])

  const again = useCallback(() => setTurn((t) => t + 1), [])
  // Only an answer to these inputs counts; anything older is not theirs.
  const mine = on && answer?.of === run ? answer : null
  return {
    it: mine?.it ?? null,
    failed: mine?.failed ?? null,
    status: mine?.status ?? null,
    loading: on && (asking || mine === null),
    again,
  }
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
