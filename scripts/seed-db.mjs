#!/usr/bin/env node
/**
 * Seed Hanzo Market (the `hub` collections) on Hanzo Base.
 *
 * The hub runs entirely on Hanzo Base (SQLite). There is no PostgreSQL.
 * This script writes skills, personas and integrations into Base collections
 * via the PocketBase SDK, authenticating as a superuser.
 *
 * Run:
 *   BASE_URL=http://localhost:8090 \
 *   BASE_ADMIN_EMAIL=z@hanzo.ai BASE_ADMIN_PASSWORD=... \
 *   node scripts/seed-db.mjs
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, basename, relative } from 'node:path'
import PocketBase from 'pocketbase'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8090'
const ADMIN_EMAIL = process.env.BASE_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.BASE_ADMIN_PASSWORD

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('BASE_ADMIN_EMAIL and BASE_ADMIN_PASSWORD required')
  process.exit(1)
}

const pb = new PocketBase(BASE_URL)
pb.autoCancellation(false)

// Bot skills (SKILL.md in top-level dirs)
const BOT_SKILLS_DIR = process.env.BOT_SKILLS_DIR || join(import.meta.dirname, '../../hanzobot/bot/skills')
// Polymath skills (nested .md files)
const SKILLS_REPO_DIR = process.env.SKILLS_REPO_DIR || '/tmp/hanzo-skills/skills'
const PERSONAS_DIR = process.env.PERSONAS_DIR || join(import.meta.dirname, '../../hanzo/personas/personas')
const INTEGRATIONS_DIR = process.env.INTEGRATIONS_DIR || join(import.meta.dirname, '../../hanzo/auto/packages/pieces/community')

/** Return the first existing record matching filter, or null. */
async function findOne(collection, filter) {
  const list = await pb.collection(collection).getList(1, 1, { filter })
  return list.items[0] ?? null
}

async function ensureSeedUser() {
  const existing = await findOne('users', 'handle = "hanzo"')
  if (existing) return existing.id

  const created = await pb.collection('users').create({
    handle: 'hanzo',
    displayName: 'Hanzo',
    role: 'admin',
    trustedPublisher: true,
  })
  return created.id
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: content }

  const fm = {}
  const raw = match[1]
  const nameMatch = raw.match(/^name:\s*(.+)$/m)
  if (nameMatch) fm.name = nameMatch[1].trim()
  const descMatch = raw.match(/^description:\s*(.+)$/m)
  if (descMatch) fm.description = descMatch[1].trim()

  return { frontmatter: fm, body: match[2] }
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\.md$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function extractTitle(content) {
  const h1 = content.match(/^#\s+(.+)$/m)
  return h1 ? h1[1].trim() : null
}

async function insertSkill(slug, displayName, summary, content, userId, extra = {}) {
  if (await findOne('skills', `slug = ${JSON.stringify(slug)}`)) return false

  const skill = await pb.collection('skills').create({
    slug,
    displayName,
    summary,
    ownerUserId: userId,
    moderationStatus: 'active',
    statsVersions: 1,
    ...extra,
  })

  const { frontmatter, body } = parseFrontmatter(content)
  const files = [{ path: 'SKILL.md', size: content.length, storageKey: `skills/${slug}/SKILL.md`, sha256: null }]
  const parsed = extra.parsed ?? { frontmatter, body: body.slice(0, 500) }

  const ver = await pb.collection('skill_versions').create({
    skillId: skill.id,
    version: extra.version ?? '1.0.0',
    changelog: 'Initial seed',
    files: extra.files ?? files,
    parsed,
    createdBy: userId,
  })

  await pb.collection('skills').update(skill.id, { latestVersionId: ver.id })
  return true
}

async function seedBotSkills(userId) {
  let dirs
  try { dirs = await readdir(BOT_SKILLS_DIR, { withFileTypes: true }) } catch { return 0 }

  let count = 0
  for (const dir of dirs.filter((d) => d.isDirectory())) {
    const slug = dir.name
    let content
    try { content = await readFile(join(BOT_SKILLS_DIR, slug, 'SKILL.md'), 'utf8') } catch { continue }

    const { frontmatter } = parseFrontmatter(content)
    const displayName = frontmatter.name || slug
    const summary = frontmatter.description || ''

    if (await insertSkill(slug, displayName, summary, content, userId)) count++
  }
  return count
}

async function walkDir(dir) {
  const results = []
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return results }

  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...await walkDir(full))
    } else if (entry.name.endsWith('.md') && !entry.name.startsWith('_') && entry.name !== 'INDEX.md' && entry.name !== 'README.md') {
      // Skip resource/reference files
      if (!full.includes('/resources/')) {
        results.push(full)
      }
    }
  }
  return results
}

async function seedRepoSkills(userId) {
  const files = await walkDir(SKILLS_REPO_DIR)
  let count = 0

  for (const filePath of files) {
    let content
    try { content = await readFile(filePath, 'utf8') } catch { continue }

    const relPath = relative(SKILLS_REPO_DIR, filePath)
    const { frontmatter, body } = parseFrontmatter(content)

    // Determine slug from path
    const pathParts = relPath.replace(/\.md$/, '').split('/')
    let slug
    if (basename(filePath) === 'SKILL.md') {
      // dir/SKILL.md → use dir name
      slug = slugify(pathParts.slice(0, -1).join('-'))
    } else {
      // dir/name.md → use full path
      slug = slugify(pathParts.join('-'))
    }

    if (!slug) continue

    const title = frontmatter.name || extractTitle(body || content) || pathParts[pathParts.length - 1].replace(/-/g, ' ')
    const displayName = title.charAt(0).toUpperCase() + title.slice(1)
    const summary = frontmatter.description || ''

    if (await insertSkill(slug, displayName, summary, content, userId)) count++
  }
  return count
}

async function seedPersonas(userId) {
  let dirs
  try { dirs = await readdir(PERSONAS_DIR, { withFileTypes: true }) } catch { return 0 }

  let count = 0
  for (const dir of dirs.filter((d) => d.isDirectory())) {
    const slug = dir.name
    let profile = {}
    try { profile = JSON.parse(await readFile(join(PERSONAS_DIR, slug, 'profile.json'), 'utf8')) } catch { continue }

    let personaMd = ''
    try { personaMd = await readFile(join(PERSONAS_DIR, slug, 'PERSONA.md'), 'utf8') } catch {}

    const displayName = profile.name || slug.replace(/_/g, ' ')
    const summary = profile.tagline || profile.description || ''

    if (await findOne('personas', `slug = ${JSON.stringify(slug)}`)) { count++; continue }

    const persona = await pb.collection('personas').create({
      slug,
      displayName,
      summary,
      ownerUserId: userId,
      statsVersions: 1,
    })

    const files = [{ path: 'profile.json', size: JSON.stringify(profile).length, storageKey: `personas/${slug}/profile.json`, sha256: null }]
    if (personaMd) files.push({ path: 'PERSONA.md', size: personaMd.length, storageKey: `personas/${slug}/PERSONA.md`, sha256: null })

    const parsed = { frontmatter: { name: displayName, description: summary }, profile }

    const ver = await pb.collection('persona_versions').create({
      personaId: persona.id,
      version: '1.0.0',
      changelog: 'Initial seed',
      files,
      parsed,
      createdBy: userId,
    })

    await pb.collection('personas').update(persona.id, { latestVersionId: ver.id })
    count++
  }
  return count
}

function extractPieceMeta(source) {
  // Extract displayName, description, logoUrl from createPiece({ ... })
  const meta = {}
  const nameMatch = source.match(/displayName\s*:\s*['"`]([^'"`]+)['"`]/)
  if (nameMatch) meta.displayName = nameMatch[1]
  const descMatch = source.match(/description\s*:\s*['"`]([^'"`]+)['"`]/)
  if (descMatch) meta.description = descMatch[1]
  const logoMatch = source.match(/logoUrl\s*:\s*['"`]([^'"`]+)['"`]/)
  if (logoMatch) meta.logoUrl = logoMatch[1]
  // Extract categories
  const catMatch = source.match(/categories\s*:\s*\[([^\]]*)\]/)
  if (catMatch) {
    meta.categories = catMatch[1]
      .split(',')
      .map((s) => s.trim().replace(/.*\./, '').replace(/['"]/g, ''))
      .filter(Boolean)
  }
  // Count actions/triggers
  const actionsMatch = source.match(/actions\s*:\s*\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/s)
  if (actionsMatch) {
    meta.actionCount = (actionsMatch[1].match(/\w+Action|createAction|create\w+Action/g) || []).length
    if (meta.actionCount === 0) meta.actionCount = (actionsMatch[1].match(/,/g) || []).length + 1
  }
  const triggersMatch = source.match(/triggers\s*:\s*\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/s)
  if (triggersMatch) {
    meta.triggerCount = (triggersMatch[1].match(/\w+Trigger|createTrigger|create\w+Trigger|new\w+Trigger/g) || []).length
    if (meta.triggerCount === 0) meta.triggerCount = (triggersMatch[1].match(/,/g) || []).length + 1
  }
  return meta
}

async function seedIntegrations(userId) {
  let dirs
  try { dirs = await readdir(INTEGRATIONS_DIR, { withFileTypes: true }) } catch { return 0 }

  let count = 0
  for (const dir of dirs.filter((d) => d.isDirectory())) {
    const slug = 'integration-' + dir.name
    if (await findOne('skills', `slug = ${JSON.stringify(slug)}`)) continue

    // Read package.json for basic metadata
    let pkg = {}
    try { pkg = JSON.parse(await readFile(join(INTEGRATIONS_DIR, dir.name, 'package.json'), 'utf8')) } catch { continue }

    // Read src/index.ts for createPiece metadata
    let source = ''
    try { source = await readFile(join(INTEGRATIONS_DIR, dir.name, 'src', 'index.ts'), 'utf8') } catch {
      try { source = await readFile(join(INTEGRATIONS_DIR, dir.name, 'src', 'index.tsx'), 'utf8') } catch {}
    }

    const meta = extractPieceMeta(source)
    const displayName = meta.displayName || pkg.displayName || dir.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    const summary = meta.description || pkg.description || ''

    const parsed = {
      frontmatter: { name: displayName, description: summary },
      integration: {
        package: pkg.name || null,
        version: pkg.version || null,
        logoUrl: meta.logoUrl || `https://cdn.activepieces.com/pieces/${dir.name}.png`,
        categories: meta.categories || [],
        actionCount: meta.actionCount || 0,
        triggerCount: meta.triggerCount || 0,
      },
    }
    const files = [{ path: 'package.json', size: JSON.stringify(pkg).length, storageKey: `integrations/${dir.name}/package.json`, sha256: null }]

    await insertSkill(slug, displayName, summary, '', userId, {
      batch: 'integration',
      version: pkg.version || '1.0.0',
      parsed,
      files,
    })
    count++
  }
  return count
}

async function main() {
  console.log('Seeding Hanzo Market (Base) ...')
  await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD)

  const userId = await ensureSeedUser()
  console.log(`Seed user: ${userId}`)

  const botSkills = await seedBotSkills(userId)
  console.log(`Bot skills: ${botSkills} new`)

  const repoSkills = await seedRepoSkills(userId)
  console.log(`Repo skills: ${repoSkills} new`)

  const personaCount = await seedPersonas(userId)
  console.log(`Personas: ${personaCount} (new + existing)`)

  const integrations = await seedIntegrations(userId)
  console.log(`Integrations: ${integrations} new`)

  const totalSkills = (await pb.collection('skills').getList(1, 1, { filter: 'batch = "" || batch != "integration"' })).totalItems
  const totalIntegrations = (await pb.collection('skills').getList(1, 1, { filter: 'batch = "integration"' })).totalItems
  const totalPersonas = (await pb.collection('personas').getList(1, 1)).totalItems
  console.log(`\nTotals: ${totalSkills} skills, ${totalIntegrations} integrations, ${totalPersonas} personas`)

  console.log('Done.')
}

main().catch((err) => { console.error(err); process.exit(1) })
