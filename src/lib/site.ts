import { getBrand } from '../brand/loader'

export type SiteMode = 'skills' | 'personas'

const DEFAULT_PERSONAHUB_SITE_URL = 'https://personas.hanzo.ai'
const DEFAULT_PERSONAHUB_HOST = 'personas.hanzo.ai'
const LEGACY_HOSTS = new Set([
  'hub.hanzo.bot',
  'clawhub.ai',
  'www.clawhub.ai',
  'auth.clawhub.com',
  'clawdhub.ai',
])

export function normalizeMarketSiteOrigin(value?: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (LEGACY_HOSTS.has(url.hostname.toLowerCase())) {
      return getBrand().url
    }
    return url.origin
  } catch {
    return null
  }
}

export function getMarketSiteUrl() {
  return normalizeMarketSiteOrigin(import.meta.env.VITE_SITE_URL) ?? getBrand().url
}

export function getPersonaHubSiteUrl() {
  const explicit = import.meta.env.VITE_PERSONAHUB_SITE_URL
  if (explicit) return explicit

  const siteUrl = import.meta.env.VITE_SITE_URL
  if (siteUrl) {
    try {
      const url = new URL(siteUrl)
      if (
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '0.0.0.0'
      ) {
        return url.origin
      }
    } catch {
      // ignore invalid URLs, fall through to default
    }
  }

  return DEFAULT_PERSONAHUB_SITE_URL
}

export function getPersonaHubHost() {
  return import.meta.env.VITE_PERSONAHUB_HOST ?? DEFAULT_PERSONAHUB_HOST
}

export function detectSiteMode(host?: string | null): SiteMode {
  if (!host) return 'skills'
  const personaHubHost = getPersonaHubHost().toLowerCase()
  const lower = host.toLowerCase()
  if (lower === personaHubHost || lower.endsWith(`.${personaHubHost}`)) return 'personas'
  return 'skills'
}

export function detectSiteModeFromUrl(value?: string | null): SiteMode {
  if (!value) return 'skills'
  try {
    const host = new URL(value).hostname
    return detectSiteMode(host)
  } catch {
    return detectSiteMode(value)
  }
}

export function getSiteMode(): SiteMode {
  if (typeof window !== 'undefined') {
    return detectSiteMode(window.location.hostname)
  }
  const forced = import.meta.env.VITE_SITE_MODE
  if (forced === 'personas' || forced === 'skills') return forced

  const personaHubSite = import.meta.env.VITE_PERSONAHUB_SITE_URL
  if (personaHubSite) return detectSiteModeFromUrl(personaHubSite)

  const siteUrl = import.meta.env.VITE_SITE_URL ?? process.env.SITE_URL
  if (siteUrl) return detectSiteModeFromUrl(siteUrl)

  return 'skills'
}

export function getSiteName(mode?: SiteMode) {
  return mode === 'personas' ? 'PersonaHub' : getBrand().title
}

export function getSiteDescription(mode?: SiteMode) {
  return mode === 'personas'
    ? 'PersonaHub — the home for PERSONA.md bundles and personal system lore.'
    : getBrand().brand.description
}

export function getSiteUrlForMode(mode: SiteMode = getSiteMode()) {
  return mode === 'personas' ? getPersonaHubSiteUrl() : getMarketSiteUrl()
}
