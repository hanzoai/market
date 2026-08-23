/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  authApi,
  githubImportApi,
  managementApi,
  personasApi,
  searchApi,
  skillsApi,
  telemetryApi,
  tokensApi,
  uploadApi,
  usersApi,
} from './api'

/** Every request the client made, in order. */
let calls: Array<{ url: string; method: string; body: unknown; auth?: string }> = []

beforeEach(() => {
  calls = []
  window.localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>
      calls.push({
        url: String(url),
        method: init?.method ?? 'GET',
        // apiFetch always stringifies, so anything else would be the client
        // changing shape rather than this test being lax.
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
        auth: headers['Authorization'],
      })
      return new Response(JSON.stringify({ ok: true, items: [], candidates: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
})

afterEach(() => vi.unstubAllGlobals())

const urlOf = () => calls[0]?.url ?? ''

describe('request shape', () => {
  it('sends every path under /v1, never a second /api segment', async () => {
    await skillsApi.get('weather')
    expect(urlOf()).toBe('/api/v1/skills/weather')
    // one `/api` from the base, one `/v1` from the path — and no `/api/api`
    expect(urlOf().match(/\/api\//g)).toHaveLength(1)
  })

  it('sends no Authorization header when no token is stored', async () => {
    await skillsApi.get('weather')
    expect(calls[0]?.auth).toBeUndefined()
  })

  it('bearers the stored token when there is one', async () => {
    window.localStorage.setItem('market.session.token', 'tok123')
    await skillsApi.get('weather')
    expect(calls[0]?.auth).toBe('Bearer tok123')
  })

  it('raises ApiError carrying the message the server sent, on a non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ error: 'nope' }), { status: 403 })))
    await expect(skillsApi.get('weather')).rejects.toThrow('nope')
  })
})

describe('paths', () => {
  const cases: Array<[string, () => Promise<unknown>, string, string]> = [
    ['skills list',        () => skillsApi.list({ sort: 'stars', limit: 5 }), '/api/v1/skills?', 'GET'],
    ['skill detail',       () => skillsApi.getDetail('weather'),             '/api/v1/skills/weather/detail', 'GET'],
    ['skill versions',     () => skillsApi.versions('weather', 10),          '/api/v1/skills/weather/versions?limit=10', 'GET'],
    ['skill comments',     () => skillsApi.comments('weather'),              '/api/v1/skills/weather/comments', 'GET'],
    ['add comment',        () => skillsApi.addComment('weather', 'hi'),      '/api/v1/skills/weather/comments', 'POST'],
    ['delete comment',     () => skillsApi.deleteComment('weather', 'c1'),   '/api/v1/skills/weather/comments/c1', 'DELETE'],
    ['toggle star',        () => skillsApi.toggleStar('weather'),            '/api/v1/skills/weather/stars', 'POST'],
    ['is starred',         () => skillsApi.isStarred('weather'),             '/api/v1/skills/weather/stars/me', 'GET'],
    ['personas list',      () => personasApi.list({ limit: 3 }),             '/api/v1/personas?', 'GET'],
    ['persona detail',     () => personasApi.getDetail('archivist'),         '/api/v1/personas/archivist/detail', 'GET'],
    ['persona versions',   () => personasApi.versions('archivist', 5),       '/api/v1/personas/archivist/versions?limit=5', 'GET'],
    ['persona comments',   () => personasApi.comments('archivist'),          '/api/v1/personas/archivist/comments', 'GET'],
    ['user by handle',     () => usersApi.get('ada'),                        '/api/v1/users/ada', 'GET'],
    ['search skills',      () => searchApi.skills('rain', 5),                '/api/v1/search', 'GET'],
    ['logout',             () => authApi.logout(),                           '/api/auth/logout', 'POST'],
    ['github preview',     () => githubImportApi.preview('https://x/y'),     '/api/v1/import/github/preview', 'POST'],
    ['telemetry installed',() => telemetryApi.getMyInstalled(false),         '/api/v1/telemetry/installed?', 'GET'],
    ['recent versions',    () => managementApi.listRecentVersions(5),        '/api/v1/management/recent-versions?limit=5', 'GET'],
    ['reported skills',    () => managementApi.listReportedSkills(5),        '/api/v1/management/reported-skills?limit=5', 'GET'],
    ['duplicates',         () => managementApi.listDuplicateCandidates(5),   '/api/v1/management/duplicate-candidates?limit=5', 'GET'],
  ]

  for (const [name, call, expectedUrl, method] of cases) {
    it(`${name} -> ${method} ${expectedUrl}`, async () => {
      await call()
      expect(calls[0]?.url).toContain(expectedUrl)
      expect(calls[0]?.method).toBe(method)
    })
  }
})

describe('bodies', () => {
  it('puts the comment in the body, not the path', async () => {
    await skillsApi.addComment('weather', 'nice one')
    expect(calls[0]?.body).toEqual({ body: 'nice one' })
    expect(calls[0]?.url).not.toContain('nice')
  })

  it('sends the url it was asked to import', async () => {
    await githubImportApi.preview('https://github.com/a/b')
    expect(calls[0]?.body).toEqual({ url: 'https://github.com/a/b' })
  })
})

describe('token endpoints', () => {
  it('lists and revokes under /v1/tokens', async () => {
    await tokensApi.list()
    expect(calls[0]?.url).toContain('/api/v1/tokens')
  })
})

describe('upload', () => {
  it('asks for an upload url under /v1/upload, with the filename in the body', async () => {
    await uploadApi.getUploadUrl('a.md', 'text/markdown')
    expect(calls[0]?.url).toContain('/api/v1/upload/url')
    expect(calls[0]?.body).toEqual({ filename: 'a.md', contentType: 'text/markdown' })
  })
})

describe('the rest of the surface', () => {
  // Every remaining endpoint, asserted on the two things a client can get wrong
  // without anyone noticing until production: where it sends and how.
  const rest: Array<[string, () => Promise<unknown>, string, string]> = [
    ['me',                 () => authApi.me(),                                   '/api/auth/me', 'GET'],
    ['skill existing',     () => skillsApi.getExisting('w'),                     '/api/v1/skills/w/detail', 'GET'],
    ['skill files',        () => skillsApi.files('w', '1.0.0'),                  '/api/v1/skills/w/versions/1.0.0/files', 'GET'],
    ['skill delete',       () => skillsApi.delete('w'),                          '/api/v1/skills/w', 'DELETE'],
    ['skill undelete',     () => skillsApi.undelete('w'),                        '/api/v1/skills/w/undelete', 'POST'],
    ['file text',          () => skillsApi.getFileText('w', 'v1', 'a.md'),       '/api/v1/skills/w/versions/v1/file', 'GET'],
    ['skill readme',       () => skillsApi.getReadme('w', 'v1'),                 '/api/v1/skills/w/versions/v1/readme', 'GET'],
    ['skill report',       () => skillsApi.report('w', 'spam'),                  '/api/v1/skills/w/report', 'POST'],
    ['skill tags',         () => skillsApi.updateTags('w', [{ tag: 'latest', versionId: 'v1' }]), '/api/v1/skills/w/tags', 'PUT'],
    ['user skills',        () => skillsApi.userSkills('ada'),                    '/api/v1/users/ada/skills', 'GET'],
    ['search personas',    () => searchApi.personas('rain', 5),                  '/api/v1/search', 'GET'],
    ['users skills',       () => usersApi.skills('ada'),                         '/api/v1/users/ada/skills', 'GET'],
    ['users stars',        () => usersApi.stars('ada'),                          '/api/v1/users/ada/stars', 'GET'],
    ['update profile',     () => usersApi.updateProfile({ bio: 'hi' }),          '/api/v1/users/me', 'PATCH'],
    ['starred skills',     () => usersApi.starredSkills('ada', 10),              '/api/v1/users/ada/starred-skills?limit=10', 'GET'],
    ['users list',         () => usersApi.list({ limit: 10, search: 'ad' }),     '/api/v1/users?', 'GET'],
    ['set role',           () => usersApi.setRole('u1', 'moderator'),            '/api/v1/users/u1/role', 'POST'],
    ['ban user',           () => usersApi.banUser('u1', 'abuse'),                '/api/v1/users/u1/ban', 'POST'],
    ['create token',       () => tokensApi.create('laptop'),                     '/api/v1/tokens', 'POST'],
    ['revoke token',       () => tokensApi.revoke('t1'),                         '/api/v1/tokens/t1', 'DELETE'],
    ['persona existing',   () => personasApi.getExisting('a'),                   '/api/v1/personas/a/detail', 'GET'],
    ['persona add comment',() => personasApi.addComment('a', 'hi'),              '/api/v1/personas/a/comments', 'POST'],
    ['persona del comment',() => personasApi.deleteComment('a', 'c1'),           '/api/v1/personas/a/comments/c1', 'DELETE'],
    ['persona star',       () => personasApi.toggleStar('a'),                    '/api/v1/personas/a/stars', 'POST'],
    ['persona is starred', () => personasApi.isStarred('a'),                     '/api/v1/personas/a/stars/me', 'GET'],
    ['persona readme',     () => personasApi.getReadme('a', 'v1'),               '/api/v1/personas/a/versions/v1/readme', 'GET'],
    ['staff skill',        () => managementApi.getBySlugForStaff('w'),           '/api/v1/management/skills/w', 'GET'],
    ['set batch',          () => managementApi.setBatch('s1', 'b1'),             '/api/v1/management/skills/s1/batch', 'POST'],
    ['soft delete',        () => managementApi.setSoftDeleted('s1', true),       '/api/v1/management/skills/s1/soft-delete', 'POST'],
    ['hard delete',        () => managementApi.hardDelete('s1'),                 '/api/v1/management/skills/s1', 'DELETE'],
    ['change owner',       () => managementApi.changeOwner('s1', 'u2'),          '/api/v1/management/skills/s1/owner', 'POST'],
    ['set duplicate',      () => managementApi.setDuplicate('s1', 'canon'),      '/api/v1/management/skills/s1/duplicate', 'POST'],
    ['official badge',     () => managementApi.setOfficialBadge('s1', true),     '/api/v1/management/skills/s1/badge/official', 'POST'],
    ['deprecated badge',   () => managementApi.setDeprecatedBadge('s1', true),   '/api/v1/management/skills/s1/badge/deprecated', 'POST'],
    ['preview candidate',  () => githubImportApi.previewCandidate('u', 'p'),     '/api/v1/import/github/preview-candidate', 'POST'],
    ['clear telemetry',    () => telemetryApi.clearMyTelemetry(),                '/api/v1/telemetry/installed', 'DELETE'],
  ]

  for (const [name, call, expectedUrl, method] of rest) {
    it(`${name} -> ${method} ${expectedUrl}`, async () => {
      await call()
      expect(calls[0]?.url).toContain(expectedUrl)
      expect(calls[0]?.method).toBe(method)
    })
  }

  it('builds the login url against the same base, with a callback to this origin', () => {
    const url = authApi.loginUrl()
    expect(url).toContain('/api/auth/login')
    expect(url).toContain(encodeURIComponent(`${window.location.origin}/api/auth/callback`))
  })

  it('swallows a failed getExisting into null rather than throwing at the caller', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
    await expect(skillsApi.getExisting('nope')).resolves.toBeNull()
    await expect(personasApi.getExisting('nope')).resolves.toBeNull()
  })
})
