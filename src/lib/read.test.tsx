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
