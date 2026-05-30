/**
 * Generate /.well-known/brand.json + /.well-known/<appId>.json from the
 * active brand preset.
 *
 * Implements LP-0010 §4.1 "Brand/App descriptor split":
 *
 *  - /.well-known/brand.json — pure brand IDENTITY (WellKnownBrand),
 *    rarely changes, owned by the brand team.
 *  - /.well-known/<appId>.json — federation graph + API metadata
 *    (WellKnownApp) that REFERENCES the brand via a URL and an optional
 *    sha256 integrity tag.
 *
 * Back-compat: the per-app file additionally carries denormalized legacy
 * top-level fields (`title`, `domain`, `url`, `github`) and the legacy
 * `app` descriptor so existing consumers that read those fields directly
 * keep working. The legacy embedded `brand` object is dropped — consumers
 * follow the `brand` URL instead. A `brandObject` mirror is retained so
 * pre-split aggregators that expect an inline object still see one.
 *
 * Inputs:
 *  - BRAND_ID env (default "generic"): selects src/brand/presets/<id>.json
 *
 * Outputs (under public/):
 *  - brand.json                 — legacy mashed payload (loader.ts reads this)
 *  - .well-known/brand.json     — new identity-only payload
 *  - .well-known/<appId>.json   — new split payload (+ legacy fields)
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

import type {
  AppDescriptor,
  ChainBinding,
  FederationPeer,
  MergedBrand,
  WellKnownApp,
  WellKnownBrand,
} from '@luxfi/brand-types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolvePath(__dirname, '..')

export interface GenerateResult {
  brandId: string
  appId: string
  brandPath: string
  appPath: string
  brandHash: string
}

/**
 * Pure projection of a preset onto the identity-only WellKnownBrand shape.
 * Keeps every field that describes the brand qua brand; drops everything
 * else (chains, peers, capabilities, API root, per-app domains).
 */
export function toWellKnownBrand(preset: MergedBrand): WellKnownBrand {
  const b = preset.brand
  const wk: WellKnownBrand = {
    brandId: preset.brandId,
    name: b.name,
    title: b.title,
    shortName: b.shortName,
    description: b.description,
    appDomain: b.appDomain,
  }
  if (b.labsName !== undefined) wk.labsName = b.labsName
  if (b.legalEntity !== undefined) wk.legalEntity = b.legalEntity
  if (b.copyrightHolder !== undefined) wk.copyrightHolder = b.copyrightHolder
  if (b.complianceEmail !== undefined) wk.complianceEmail = b.complianceEmail
  if (b.supportEmail !== undefined) wk.supportEmail = b.supportEmail
  if (b.twitter !== undefined) wk.twitter = b.twitter
  if (b.farcaster !== undefined) wk.farcaster = b.farcaster
  if (b.linkedin !== undefined) wk.linkedin = b.linkedin
  if (b.tiktok !== undefined) wk.tiktok = b.tiktok
  if (b.github !== undefined) wk.github = b.github
  if (b.discord !== undefined) wk.discord = b.discord
  if (b.logoUrl !== undefined) wk.logoUrl = b.logoUrl
  if (b.faviconUrl !== undefined) wk.faviconUrl = b.faviconUrl
  if (b.primaryColor !== undefined) wk.primaryColor = b.primaryColor
  if (b.theme !== undefined) wk.theme = b.theme
  return wk
}

/**
 * Pure projection of a preset onto the federation WellKnownApp shape,
 * with the brand referenced by URL instead of embedded inline.
 *
 * Capabilities are derived deterministically from the preset so the
 * well-known stays consistent across reformats.
 */
export function toWellKnownApp(
  preset: MergedBrand,
  brandHref: string,
  brandHash: string,
): WellKnownApp {
  const capabilities = ['publish', 'search', 'install', 'personas']
  return {
    appId: preset.appId,
    title: preset.title,
    domain: preset.domain,
    url: preset.url,
    github: preset.github,
    brand: brandHref,
    brandHash,
    ...(preset.chain ? { chain: preset.chain } : {}),
    peers: Array.isArray(preset.peers) ? preset.peers : [],
    capabilities,
    apiVersion: '1',
    apiBase: `${preset.url.replace(/\/$/, '')}/api/v1`,
  }
}

/**
 * Compose the on-the-wire payload for /.well-known/<appId>.json.
 *
 * The new schema (WellKnownApp) plus legacy back-compat fields that
 * existing consumers may still depend on:
 *   - `brandId`, `app` — historically present on the mashed shape
 *   - `brandObject` — mirror of the embedded brand object for pre-split
 *     aggregators that haven't migrated to following the `brand` URL
 */
export interface WellKnownAppCompatPayload extends WellKnownApp {
  /** Stable brand identifier (historically present, kept for back-compat). */
  brandId: string
  /** Embedded brand object — mirror of the brand URL target. */
  brandObject: WellKnownBrand
  /** Embedded app descriptor (historically present). */
  app: AppDescriptor
}

export function toCompatPayload(
  preset: MergedBrand,
  brand: WellKnownBrand,
  app: WellKnownApp,
): WellKnownAppCompatPayload {
  return {
    ...app,
    brandId: preset.brandId,
    brandObject: brand,
    app: preset.app,
  }
}

function sha256Base64(bytes: string): string {
  return createHash('sha256').update(bytes, 'utf8').digest('base64')
}

export function generateWellKnown(brandId = process.env.BRAND_ID ?? 'generic'): GenerateResult {
  const id = (brandId.trim() || 'generic').toLowerCase()
  const presetPath = resolvePath(ROOT, 'src/brand/presets', `${id}.json`)
  if (!existsSync(presetPath) || !statSync(presetPath).isFile()) {
    throw new Error(
      `BRAND_ID=${id} but src/brand/presets/${id}.json not found. ` +
        `Create the preset or set BRAND_ID to one of the available presets.`,
    )
  }

  const preset = JSON.parse(readFileSync(presetPath, 'utf8')) as MergedBrand

  // 1. Legacy mashed bundle goes to public/brand.json (loader.ts reads this).
  const publicDir = resolvePath(ROOT, 'public')
  if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true })
  writeFileSync(resolvePath(publicDir, 'brand.json'), JSON.stringify(preset, null, 2) + '\n')

  // 2. New identity-only payload goes to /.well-known/brand.json.
  const wellKnownBrand = toWellKnownBrand(preset)
  const wellKnownBrandJson = JSON.stringify(wellKnownBrand, null, 2) + '\n'
  const wellKnownDir = resolvePath(ROOT, 'public/.well-known')
  if (!existsSync(wellKnownDir)) mkdirSync(wellKnownDir, { recursive: true })
  const brandPath = resolvePath(wellKnownDir, 'brand.json')
  writeFileSync(brandPath, wellKnownBrandJson)

  // 3. Hash the brand bytes for the subresource-integrity tag.
  const brandHash = `sha256-${sha256Base64(wellKnownBrandJson)}`

  // 4. New federation payload (with legacy back-compat fields) goes to
  //    /.well-known/<appId>.json.
  const wellKnownApp = toWellKnownApp(preset, '/.well-known/brand.json', brandHash)
  const composed = toCompatPayload(preset, wellKnownBrand, wellKnownApp)
  const appPath = resolvePath(wellKnownDir, `${preset.appId}.json`)
  writeFileSync(appPath, JSON.stringify(composed, null, 2) + '\n')

  return {
    brandId: id,
    appId: preset.appId,
    brandPath,
    appPath,
    brandHash,
  }
}

// Run when invoked directly: `bun scripts/generate-well-known.ts`.
// Avoids running when imported (vite.config.ts imports for the generate call).
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  const result = generateWellKnown()
  console.log(
    `wrote .well-known/brand.json + .well-known/${result.appId}.json for brand=${result.brandId} (${result.brandHash})`,
  )
}

// Silence unused-import warnings; the types are part of the public contract
// of this script (importers may reach into these via `import type`).
export type { ChainBinding, FederationPeer }
