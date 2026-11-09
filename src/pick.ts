// Being an account: the way in the person chose is carried to the callback, and an
// account that is signed in here is one press away. Both the sign-in page and the
// account menu use them.

import { useCallback } from 'react'
import type { Account } from '@hanzo/app/lib/accounts'

import { authorize } from '~/analytics'
import { useClient } from '~/session'

/** The way in the person chose, carried to the callback. */
export const METHOD = 'signin.method'

export function keep(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    /* a tab that keeps nothing asks again and reports no method */
  }
}

/** Read-once: the way in, or undefined. */
export function takeMethod(): string | undefined {
  try {
    const m = window.sessionStorage.getItem(METHOD) ?? undefined
    window.sessionStorage.removeItem(METHOD)
    return m
  } catch {
    return undefined
  }
}

/**
 * Be the account pressed, in a menu or the chooser: IAM's own `resume` with the
 * account named, on this origin, then on to the code it answers. False where IAM
 * has no session to spend for it, so the form is asked for the credential.
 */
export function usePick(): (account: Account) => Promise<boolean> {
  const iam = useClient()
  return useCallback(
    async (account) => {
      const next = await iam.resume(account.sub)
      if (!next) return false
      keep(METHOD, 'session')
      window.location.replace(authorize(next))
      return true
    },
    [iam],
  )
}

