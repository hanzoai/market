import type { MergedBrand } from './types'
import genericPreset from './presets/generic.json'

/**
 * Brand loader.
 *
 * Order of resolution:
 *   1. SSR / Node: prefer process.env.BRAND_ID → src/brand/presets/<id>.json
 *      (resolved at bundle time via static imports)
 *   2. Browser: read /brand.json (mounted at build time or via ConfigMap)
 *   3. Bundled fallback: presets/generic.json
 *
 * The build pipeline copies the active preset to public/brand.json so the
 * browser path matches whatever the build was tagged with. Operators can
 * override at deploy time by mounting a different brand.json over the same
 * path via a Kubernetes ConfigMap.
 */

declare const __BUILD_BRAND_ID__: string | undefined

let cached: MergedBrand | null = null

function normalize(input: unknown): MergedBrand {
  if (!input || typeof input !== 'object') {
    return genericPreset as MergedBrand
  }
  return input as MergedBrand
}

function fetchBrandSync(): MergedBrand {
  // Browser: synchronously parse the inline JSON if present, else fall back.
  if (typeof document !== 'undefined') {
    const inline = document.getElementById('__brand__')
    if (inline?.textContent) {
      try {
        return normalize(JSON.parse(inline.textContent))
      } catch {
        // fall through
      }
    }
  }
  return normalize(genericPreset)
}

export function getBrand(): MergedBrand {
  if (cached) return cached
  cached = fetchBrandSync()
  return cached
}

/**
 * Async brand load — primarily used by SSR routes and the OG image renderer
 * where `brand.json` is read off disk at runtime so a single image can be
 * re-skinned without rebuilding.
 */
export async function loadBrandAsync(): Promise<MergedBrand> {
  if (cached) return cached

  // Node / SSR path
  if (typeof window === 'undefined' && typeof process !== 'undefined') {
    try {
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const candidates = [
        process.env.BRAND_JSON_PATH,
        path.resolve(process.cwd(), 'public/brand.json'),
        path.resolve(process.cwd(), '.output/public/brand.json'),
      ].filter((p): p is string => typeof p === 'string' && p.length > 0)
      for (const candidate of candidates) {
        try {
          const raw = await fs.readFile(candidate, 'utf8')
          cached = normalize(JSON.parse(raw))
          return cached
        } catch {
          // try next
        }
      }
    } catch {
      // fall through to bundled fallback
    }
  }

  // Browser / fallback
  if (typeof fetch === 'function' && typeof window !== 'undefined') {
    try {
      const response = await fetch('/brand.json', { headers: { Accept: 'application/json' } })
      if (response.ok) {
        cached = normalize(await response.json())
        return cached
      }
    } catch {
      // fall through to bundled fallback
    }
  }

  cached = normalize(genericPreset)
  return cached
}

export function getBuildBrandId(): string {
  if (typeof __BUILD_BRAND_ID__ !== 'undefined' && __BUILD_BRAND_ID__) {
    return __BUILD_BRAND_ID__
  }
  return getBrand().brandId
}

/** Reset the in-memory cache. Used by tests; should not be called in production. */
export function resetBrandCacheForTests() {
  cached = null
}
