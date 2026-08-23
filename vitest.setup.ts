/**
 * The runtime ships an experimental `localStorage` that shadows jsdom's and is
 * inert unless started with `--localstorage-file`, so both `localStorage` and
 * `window.localStorage` are undefined under test. Anything reading a stored
 * token therefore threw rather than returning null, which is how a real crash
 * in `getStoredToken` stayed invisible to the suite.
 *
 * A per-test in-memory store restores the browser's semantics: values are
 * strings, missing keys are null, and each file starts empty.
 */
class MemoryStorage implements Storage {
  #items = new Map<string, string>()

  get length(): number {
    return this.#items.size
  }

  key(index: number): string | null {
    return [...this.#items.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    return this.#items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.#items.set(key, String(value))
  }

  removeItem(key: string): void {
    this.#items.delete(key)
  }

  clear(): void {
    this.#items.clear()
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  const store = new MemoryStorage()
  Object.defineProperty(globalThis, name, { value: store, configurable: true, writable: true })
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, name, { value: store, configurable: true, writable: true })
  }
}
