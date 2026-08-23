/** API client for the market backend. */

import type { Doc, Id } from './types'
import type { PublicPersona, PublicSkill, PublicUser } from './publicUser'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

type FetchOptions = {
  method?: string
  body?: unknown
  token?: string | null
}

async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const token = opts.token ?? getStoredToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new ApiError(response.status, (error as { error?: string }).error ?? 'Request failed')
  }

  return response.json() as Promise<T>
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ─── Token storage ──────────────────────────────────────────────────────────
const TOKEN_KEY = 'market.session.token'

// Reached through `window` rather than the bare global, which is what the guard
// above actually tests. A context can have one without the other, and there the
// guard passes and the bare global throws.
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(TOKEN_KEY)
}

// ─── Auth API ───────────────────────────────────────────────────────────────
export const authApi = {
  me: () => apiFetch<{
    id: string
    handle: string | null
    displayName: string | null
    email: string | null
    image: string | null
    bio: string | null
    role: string | null
    trustedPublisher: boolean
    createdAt: string
  }>('/auth/me'),

  loginUrl: () => `${API_BASE}/auth/login?redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth/callback')}`,

  logout: () => apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
}

// ─── Skills API ─────────────────────────────────────────────────────────────
export type Skill = {
  id: string
  slug: string
  displayName: string
  summary: string | null
  ownerUserId: string
  badges: Record<string, unknown>
  moderationStatus: string
  statsDownloads: number
  statsStars: number
  statsVersions: number
  statsComments: number
  createdAt: string
  updatedAt: string
  ownerHandle: string | null
  ownerImage: string | null
  ownerDisplayName?: string | null
}

export type SkillVersion = {
  id: string
  version: string
  changelog: string
  changelogSource: string | null
  createdBy: string
  sha256hash: string | null
  vtAnalysis: unknown
  llmAnalysis: unknown
  createdAt: string
}

/** The moderation state the detail endpoint reports for a skill. */
export type SkillModerationInfo = {
  isPendingScan: boolean
  isMalwareBlocked: boolean
  isSuspicious: boolean
  isHiddenByMod: boolean
  isRemoved: boolean
  reason?: string
}

/** What `skillsApi.getDetail` answers with. Doc-shaped: `_id`, nested stats. */
export type SkillBySlugResult = {
  skill: Doc<'skills'> | PublicSkill
  latestVersion: Doc<'skillVersions'> | null
  owner: Doc<'users'> | PublicUser | null
  pendingReview?: boolean
  moderationInfo?: SkillModerationInfo | null
  forkOf: {
    kind: 'fork' | 'duplicate'
    version: string | null
    skill: { slug: string; displayName: string }
    owner: { handle: string | null; userId: Id<'users'> | null }
  } | null
  canonical: {
    skill: { slug: string; displayName: string }
    owner: { handle: string | null; userId: Id<'users'> | null }
  } | null
} | null

/** What `personasApi.getDetail` answers with. */
export type PersonaBySlugResult = {
  persona: PublicPersona
  latestVersion: Doc<'personaVersions'> | null
  owner: PublicUser | null
} | null

export const skillsApi = {
  list: (params?: { sort?: string; limit?: number; cursor?: string }) => {
    const qs = new URLSearchParams()
    if (params?.sort) qs.set('sort', params.sort)
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.cursor) qs.set('cursor', params.cursor)
    return apiFetch<{ items: Skill[]; nextCursor?: string; hasMore: boolean }>(
      `/v1/skills?${qs}`,
    )
  },

  get: (slug: string) => apiFetch<Skill>(`/v1/skills/${slug}`),

  /** Full skill detail with owner, versions, fork info. Returns Doc-shaped objects (_id, nested stats). */
  getDetail: (slug: string, opts?: { staff?: boolean }) =>
    apiFetch<SkillBySlugResult>(`/v1/skills/${slug}/detail${opts?.staff ? '?staff=1' : ''}`),

  /** Get existing skill for update flow — returns null if not found */
  getExisting: (slug: string) =>
    apiFetch<SkillBySlugResult>(`/v1/skills/${slug}/detail`).catch(() => null),

  versions: (slug: string, limit = 50) =>
    apiFetch<{ items: SkillVersion[] }>(`/v1/skills/${slug}/versions?limit=${limit}`),

  files: (slug: string, version: string) =>
    apiFetch<{ files: Array<{ path: string; size: number; storageKey: string; sha256: string }> }>(
      `/v1/skills/${slug}/versions/${version}/files`,
    ),

  publish: (slug: string, data: {
    displayName: string
    version: string
    changelog: string
    tags?: string[]
    files: Array<{ path: string; size: number; storageKey: string; sha256: string; contentType?: string }>
  }) => apiFetch<{ skillId: string; versionId: string; version: string }>(
    `/v1/skills/${slug}/publish`,
    { method: 'POST', body: data },
  ),

  delete: (slug: string) =>
    apiFetch<{ ok: boolean }>(`/v1/skills/${slug}`, { method: 'DELETE' }),

  undelete: (slug: string) =>
    apiFetch<{ ok: boolean }>(`/v1/skills/${slug}/undelete`, { method: 'POST' }),

  toggleStar: (slug: string) =>
    apiFetch<{ starred: boolean }>(`/v1/skills/${slug}/stars`, { method: 'POST' }),

  isStarred: (slug: string) =>
    apiFetch<{ starred: boolean }>(`/v1/skills/${slug}/stars/me`),

  comments: (slug: string) =>
    apiFetch<{ items: Array<{
      id: string
      body: string
      userId: string
      createdAt: string
      userHandle: string | null
      userImage: string | null
      userDisplayName: string | null
    }> }>(`/v1/skills/${slug}/comments`),

  addComment: (slug: string, body: string) =>
    apiFetch<{ id: string }>(`/v1/skills/${slug}/comments`, { method: 'POST', body: { body } }),

  deleteComment: (slug: string, commentId: string) =>
    apiFetch<{ ok: boolean }>(`/v1/skills/${slug}/comments/${commentId}`, { method: 'DELETE' }),

  getFileText: (slug: string, versionId: string, path: string) =>
    apiFetch<{ text: string; size: number; sha256: string }>(
      `/v1/skills/${slug}/versions/${versionId}/file?path=${encodeURIComponent(path)}`,
    ),

  getReadme: (slug: string, versionId: string) =>
    apiFetch<{ text: string }>(`/v1/skills/${slug}/versions/${versionId}/readme`),

  report: (slug: string, reason: string) =>
    apiFetch<{ reported: boolean }>(`/v1/skills/${slug}/report`, { method: 'POST', body: { reason } }),

  updateTags: (slug: string, tags: Array<{ tag: string; versionId: string }>) =>
    apiFetch<{ ok: boolean }>(`/v1/skills/${slug}/tags`, { method: 'PUT', body: { tags } }),

  userSkills: (handle: string) =>
    apiFetch<{ items: Skill[] }>(`/v1/users/${handle}/skills`),

  generateChangelogPreview: (data: {
    slug: string
    version: string
    readmeText: string
    filePaths: string[]
  }) => apiFetch<{ changelog: string }>(`/v1/skills/changelog-preview`, {
    method: 'POST',
    body: data,
  }),
}

// ─── Search API ─────────────────────────────────────────────────────────────
export const searchApi = {
  skills: (query: string, limit = 20) =>
    apiFetch<{ items: Array<Skill & { score: number }> }>(
      `/v1/search/skills?q=${encodeURIComponent(query)}&limit=${limit}`,
    ),

  personas: (query: string, limit = 20) =>
    apiFetch<{ items: Array<{ id: string; slug: string; displayName: string; summary: string | null; score?: number }> }>(
      `/v1/search/personas?q=${encodeURIComponent(query)}&limit=${limit}`,
    ),
}

// ─── Users API ──────────────────────────────────────────────────────────────
export const usersApi = {
  get: (handle: string) =>
    apiFetch<{
      id: string
      handle: string
      displayName: string | null
      image: string | null
      bio: string | null
      createdAt: string
    }>(`/v1/users/${handle}`),

  skills: (handle: string) =>
    apiFetch<{ items: Skill[] }>(`/v1/users/${handle}/skills`),

  stars: (handle: string) =>
    apiFetch<{ items: Array<{ skillId: string; skillSlug: string; skillDisplayName: string; starredAt: string }> }>(
      `/v1/users/${handle}/stars`,
    ),

  updateProfile: (data: { displayName?: string; bio?: string; handle?: string }) =>
    apiFetch<{ ok: boolean }>('/v1/users/me', { method: 'PATCH', body: data }),

  starredSkills: (handle: string, limit = 50) =>
    apiFetch<{ items: Skill[] }>(`/v1/users/${handle}/starred-skills?limit=${limit}`),

  list: (params?: { limit?: number; search?: string }) => {
    const qs = new URLSearchParams()
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.search) qs.set('q', params.search)
    return apiFetch<{ items: any[]; total: number }>(`/v1/users?${qs}`)
  },

  setRole: (userId: string, role: string) =>
    apiFetch<{ ok: boolean }>(`/v1/users/${userId}/role`, { method: 'POST', body: { role } }),

  banUser: (userId: string, reason?: string) =>
    apiFetch<{ ok: boolean }>(`/v1/users/${userId}/ban`, { method: 'POST', body: { reason } }),
}

// ─── Upload API ─────────────────────────────────────────────────────────────
export const uploadApi = {
  getUploadUrl: (filename: string, contentType?: string) =>
    apiFetch<{ url: string; storageKey: string }>('/v1/upload/url', {
      method: 'POST',
      body: { filename, contentType },
    }),
}

// ─── Tokens API ─────────────────────────────────────────────────────────────
export const tokensApi = {
  list: () =>
    apiFetch<{ items: Array<{ id: string; label: string; prefix: string; lastUsedAt: string | null; createdAt: string }> }>(
      '/v1/tokens',
    ),

  create: (label: string) =>
    apiFetch<{ id: string; token: string; prefix: string; label: string }>('/v1/tokens', {
      method: 'POST',
      body: { label },
    }),

  revoke: (id: string) =>
    apiFetch<{ ok: boolean }>(`/v1/tokens/${id}`, { method: 'DELETE' }),
}

// ─── Personas API ──────────────────────────────────────────────────────────────
/** A comment row as the personas endpoint reports it. Two spellings are
 *  tolerated because the server has answered both: a flat row with
 *  `userHandle`/`userDisplayName`, and one carrying a nested `user`. */
export type PersonaCommentRow = {
  id?: string
  _id?: string
  body: string
  userId: string
  createdAt: string
  user?: { handle: string | null; name?: string | null; _id?: string } | null
  userHandle?: string | null
  userDisplayName?: string | null
}

export const personasApi = {
  list: (params?: { limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.limit) qs.set('limit', String(params.limit))
    return apiFetch<{ items: any[] }>(`/v1/personas?${qs}`)
  },

  getDetail: (slug: string) => apiFetch<PersonaBySlugResult>(`/v1/personas/${slug}/detail`),

  getExisting: (slug: string) => apiFetch<PersonaBySlugResult>(`/v1/personas/${slug}/detail`).catch(() => null),

  versions: (slug: string, limit = 50) =>
    apiFetch<{ items: any[] }>(`/v1/personas/${slug}/versions?limit=${limit}`),

  comments: (slug: string) =>
    apiFetch<{ items: PersonaCommentRow[] }>(`/v1/personas/${slug}/comments`),

  addComment: (slug: string, body: string) =>
    apiFetch<{ id: string }>(`/v1/personas/${slug}/comments`, { method: 'POST', body: { body } }),

  deleteComment: (slug: string, commentId: string) =>
    apiFetch<{ ok: boolean }>(`/v1/personas/${slug}/comments/${commentId}`, { method: 'DELETE' }),

  toggleStar: (slug: string) =>
    apiFetch<{ starred: boolean }>(`/v1/personas/${slug}/stars`, { method: 'POST' }),

  isStarred: (slug: string) =>
    apiFetch<{ starred: boolean }>(`/v1/personas/${slug}/stars/me`),

  getReadme: (slug: string, versionId: string) =>
    apiFetch<{ text: string }>(`/v1/personas/${slug}/versions/${versionId}/readme`),

  publish: (data: {
    slug: string
    displayName: string
    version: string
    changelog: string
    tags: string[]
    files: Array<{ path: string; size: number; storageKey: string; sha256: string; contentType?: string }>
  }) => apiFetch<{ personaId: string; versionId: string; version: string; slug: string }>(
    `/v1/personas/publish`,
    { method: 'POST', body: data },
  ),

  generateChangelogPreview: (data: {
    slug: string
    version: string
    readmeText: string
    filePaths: string[]
  }) => apiFetch<{ changelog: string }>(`/v1/personas/changelog-preview`, {
    method: 'POST',
    body: data,
  }),
}

// ─── Management API (staff/admin) ───────────────────────────────────────────
export const managementApi = {
  getBySlugForStaff: (slug: string) => apiFetch<any>(`/v1/management/skills/${slug}`),

  listRecentVersions: (limit = 20) =>
    apiFetch<{ items: any[] }>(`/v1/management/recent-versions?limit=${limit}`),

  listReportedSkills: (limit = 25) =>
    apiFetch<{ items: any[] }>(`/v1/management/reported-skills?limit=${limit}`),

  listDuplicateCandidates: (limit = 20) =>
    apiFetch<{ items: any[] }>(`/v1/management/duplicate-candidates?limit=${limit}`),

  setBatch: (skillId: string, batch?: string) =>
    apiFetch<{ ok: boolean }>(`/v1/management/skills/${skillId}/batch`, {
      method: 'POST', body: { batch },
    }),

  setSoftDeleted: (skillId: string, deleted: boolean) =>
    apiFetch<{ ok: boolean }>(`/v1/management/skills/${skillId}/soft-delete`, {
      method: 'POST', body: { deleted },
    }),

  hardDelete: (skillId: string) =>
    apiFetch<{ ok: boolean }>(`/v1/management/skills/${skillId}`, { method: 'DELETE' }),

  changeOwner: (skillId: string, ownerUserId: string) =>
    apiFetch<{ ok: boolean }>(`/v1/management/skills/${skillId}/owner`, {
      method: 'POST', body: { ownerUserId },
    }),

  setDuplicate: (skillId: string, canonicalSlug?: string) =>
    apiFetch<{ ok: boolean }>(`/v1/management/skills/${skillId}/duplicate`, {
      method: 'POST', body: { canonicalSlug },
    }),

  setOfficialBadge: (skillId: string, official: boolean) =>
    apiFetch<{ ok: boolean }>(`/v1/management/skills/${skillId}/badge/official`, {
      method: 'POST', body: { official },
    }),

  setDeprecatedBadge: (skillId: string, deprecated: boolean) =>
    apiFetch<{ ok: boolean }>(`/v1/management/skills/${skillId}/badge/deprecated`, {
      method: 'POST', body: { deprecated },
    }),
}

// ─── GitHub Import API ──────────────────────────────────────────────────────
export const githubImportApi = {
  preview: (url: string) =>
    apiFetch<{ candidates: any[] }>(`/v1/import/github/preview`, { method: 'POST', body: { url } }),

  previewCandidate: (url: string, candidatePath: string) =>
    apiFetch<any>(`/v1/import/github/preview-candidate`, { method: 'POST', body: { url, candidatePath } }),

  importSkill: (data: {
    url: string
    commit: string
    candidatePath: string
    selectedPaths: string[]
    slug: string
    displayName: string
    version: string
    tags: string[]
  }) => apiFetch<{ slug: string; skillId: string; versionId: string }>(
    `/v1/import/github/import`,
    { method: 'POST', body: data },
  ),
}

// ─── Telemetry API ──────────────────────────────────────────────────────────
/** What `telemetryApi.installed` answers with. */
export type TelemetryResponse = {
  roots: Array<{
    rootId: string
    label: string
    firstSeenAt: number
    lastSeenAt: number
    expiredAt?: number
    skills: Array<{
      skill: {
        slug: string
        displayName: string
        summary?: string
        stats: unknown
        ownerUserId: string
      }
      firstSeenAt: number
      lastSeenAt: number
      lastVersion?: string
      removedAt?: number
    }>
  }>
  cutoffDays: number
}

export const telemetryApi = {
  getMyInstalled: (includeRemoved = false) =>
    apiFetch<TelemetryResponse>(`/v1/telemetry/installed?includeRemoved=${includeRemoved}`),

  clearMyTelemetry: () =>
    apiFetch<{ ok: boolean }>('/v1/telemetry/installed', { method: 'DELETE' }),
}
