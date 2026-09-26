import { act, renderHook, waitFor } from '@testing-library/react'

import { Refusal } from '~/lib/http'
import { useRead, useRun } from '~/lib/read'

describe('useRead', () => {
  it('answers, and asks again on demand', async () => {
    let n = 0
    const { result } = renderHook(() => useRead(() => Promise.resolve(++n), []))
    await waitFor(() => expect(result.current.it).toBe(1))
    expect(result.current.loading).toBe(false)
    act(() => result.current.again())
    await waitFor(() => expect(result.current.it).toBe(2))
  })

  it('keeps the refusal and its status', async () => {
    const { result } = renderHook(() => useRead(() => Promise.reject(new Refusal(404, 'no route')), []))
    await waitFor(() => expect(result.current.failed).toBe('no route'))
    expect(result.current.status).toBe(404)
    const plain = renderHook(() => useRead(() => Promise.reject(new Error('down')), []))
    await waitFor(() => expect(plain.result.current.failed).toBe('down'))
    expect(plain.result.current.status).toBeNull()
  })

  it('does nothing without a read', () => {
    const { result } = renderHook(() => useRead<number>(null, []))
    expect(result.current).toMatchObject({ it: null, failed: null, loading: false })
  })

  // Red market-2: org A answered, then org B's read was refused, and the screen
  // for B still held A's record.
  it('never keeps one input’s answer when the next input is refused', async () => {
    const get = (org: string) =>
      org === 'acme' ? Promise.resolve({ org: 'acme', identity: 'verified' }) : Promise.reject(new Refusal(404, 'none for globex'))
    const { result, rerender } = renderHook(({ org }) => useRead(() => get(org), [org]), { initialProps: { org: 'acme' } })
    await waitFor(() => expect(result.current.it).toEqual({ org: 'acme', identity: 'verified' }))
    rerender({ org: 'globex' })
    // The moment the inputs change, the old answer is gone — before any reply.
    expect(result.current.it).toBeNull()
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.status).toBe(404))
    expect(result.current.it).toBeNull()
    expect(result.current.failed).toBe('none for globex')
  })

  // Red market-1: a clearance for $250 stood in for the one asked for $50,000
  // while that one was in flight.
  it('shows no answer while the new inputs are asked', async () => {
    let release: (v: string) => void = () => {}
    const slow = new Promise<string>((r) => {
      release = r
    })
    const { result, rerender } = renderHook(({ amount }) => useRead(() => (amount === '250' ? Promise.resolve('cleared 250') : slow), [amount]), {
      initialProps: { amount: '250' },
    })
    await waitFor(() => expect(result.current.it).toBe('cleared 250'))
    rerender({ amount: '50000' })
    expect(result.current).toMatchObject({ it: null, loading: true, failed: null })
    await act(async () => release('cleared 50000'))
    expect(result.current).toMatchObject({ it: 'cleared 50000', loading: false })
  })

  it('drops the answer when asking again is refused', async () => {
    let n = 0
    const { result } = renderHook(() => useRead(() => (++n === 1 ? Promise.resolve('first') : Promise.reject(new Refusal(500, 'down'))), []))
    await waitFor(() => expect(result.current.it).toBe('first'))
    act(() => result.current.again())
    await waitFor(() => expect(result.current.failed).toBe('down'))
    expect(result.current.it).toBeNull()
  })

  it('keeps showing the answer while the same inputs are asked again', async () => {
    let n = 0
    const { result } = renderHook(() => useRead(() => Promise.resolve(++n), []))
    await waitFor(() => expect(result.current.it).toBe(1))
    act(() => result.current.again())
    expect(result.current).toMatchObject({ it: 1, loading: true })
    await waitFor(() => expect(result.current.it).toBe(2))
  })
})

describe('useRun', () => {
  it('runs one write and reports a refusal', async () => {
    const { result } = renderHook(() => useRun())
    let got: number | undefined
    await act(async () => {
      got = await result.current.run(() => Promise.resolve(7))
    })
    expect(got).toBe(7)
    await act(async () => {
      got = await result.current.run(() => Promise.reject(new Refusal(422, 'unknown tool')))
    })
    expect(got).toBeUndefined()
    expect(result.current).toMatchObject({ failed: 'unknown tool', status: 422, busy: false })
    await act(async () => {
      await result.current.run(() => Promise.reject(new Error('offline')))
    })
    expect(result.current).toMatchObject({ failed: 'offline', status: null })
  })
})
