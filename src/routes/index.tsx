import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { skillsApi, searchApi, type Skill } from '../lib/api'
import { skillToPublic } from '../lib/publicUser'
import { InstallSwitcher } from '../components/InstallSwitcher'
import { SkillCard } from '../components/SkillCard'
import { SkillStatsTripletLine } from '../components/SkillStats'
import { PersonaCard } from '../components/PersonaCard'
import { PersonaStatsTripletLine } from '../components/PersonaStats'
import { UserBadge } from '../components/UserBadge'
import { getSkillBadges } from '../lib/badges'
import type { PublicPersona } from '../lib/publicUser'
import { getBrand } from '../brand/loader'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main>
      <HeroSection />
      <HighlightedSkills />
      <LatestPersonas />
      <PopularSkills />
    </main>
  )
}

function HeroSection() {
  const brand = getBrand()
  return (
    <section className="hero">
      <div className="hero-inner">
        <div className="hero-copy fade-up" data-delay="1">
          <span className="hero-badge">Skills. Personas. Agents.</span>
          <h1 className="hero-title">{brand.title}, {brand.app.tagline}</h1>
          <p className="hero-subtitle">
            Upload skills, share personas, and discover agents — versioned, searchable, no gatekeeping.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <Link to="/upload" search={{ updateSlug: undefined }} className="btn btn-primary">
              Publish
            </Link>
            <Link
              to="/skills"
              search={{
                q: undefined,
                sort: undefined,
                dir: undefined,
                highlighted: undefined,
                nonSuspicious: true,
                view: undefined,
                focus: undefined,
              }}
              className="btn"
            >
              Browse skills
            </Link>
            <Link
              to="/personas"
              search={{
                q: undefined,
                sort: undefined,
                dir: undefined,
                view: undefined,
                focus: undefined,
              }}
              className="btn"
            >
              Browse personas
            </Link>
          </div>
        </div>
        <div className="hero-card hero-search-card fade-up" data-delay="2">
          <div className="hero-install" style={{ marginTop: 18 }}>
            <div className="stat">Search skills. Versioned, rollback-ready.</div>
            <InstallSwitcher exampleSlug="sonoscli" />
          </div>
        </div>
      </div>
    </section>
  )
}

function HighlightedSkills() {
  const [highlighted, setHighlighted] = useState<Skill[]>([])

  useEffect(() => {
    skillsApi
      .list({ sort: 'stars', limit: 6 })
      .then((r) => setHighlighted(r.items))
      .catch(() => {})
  }, [])

  return (
    <section className="section">
      <h2 className="section-title">Highlighted skills</h2>
      <p className="section-subtitle">Curated signal — highlighted for quick trust.</p>
      <div className="grid">
        {highlighted.length === 0 ? (
          <div className="card">No highlighted skills yet.</div>
        ) : (
          highlighted.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skillToPublic(skill)}
              badge={getSkillBadges(skill)}
              summaryFallback="A fresh skill bundle."
              meta={
                <div className="skill-card-footer-rows">
                  <UserBadge
                    user={null}
                    fallbackHandle={skill.ownerHandle ?? null}
                    prefix="by"
                    link={false}
                  />
                  <div className="stat">
                    <SkillStatsTripletLine stats={{ downloads: skill.statsDownloads, stars: skill.statsStars, versions: skill.statsVersions, comments: skill.statsComments }} />
                  </div>
                </div>
              }
            />
          ))
        )}
      </div>
    </section>
  )
}

function LatestPersonas() {
  const [latest, setLatest] = useState<PublicPersona[]>([])

  useEffect(() => {
    searchApi
      .personas('', 6)
      .then((r) => setLatest(r.items as unknown as PublicPersona[]))
      .catch(() => {})
  }, [])

  return (
    <section className="section">
      <h2 className="section-title">Latest personas</h2>
      <p className="section-subtitle">Scientifically-modeled personalities for agents.</p>
      <div className="grid">
        {latest.length === 0 ? (
          <div className="card">No personas yet. Be the first.</div>
        ) : (
          latest.map((persona) => (
            <PersonaCard
              key={persona._id}
              persona={persona}
              summaryFallback="A PERSONA.md bundle."
              meta={
                <div className="stat">
                  <PersonaStatsTripletLine stats={persona.stats} />
                </div>
              }
            />
          ))
        )}
      </div>
      <div className="section-cta">
        <Link
          to="/personas"
          search={{
            q: undefined,
            sort: undefined,
            dir: undefined,
            view: undefined,
            focus: undefined,
          }}
          className="btn"
        >
          See all personas
        </Link>
      </div>
    </section>
  )
}

function PopularSkills() {
  const [popular, setPopular] = useState<Skill[]>([])

  useEffect(() => {
    skillsApi
      .list({ sort: 'downloads', limit: 12 })
      .then((r) => setPopular(r.items))
      .catch(() => {})
  }, [])

  return (
    <section className="section">
      <h2 className="section-title">Popular skills</h2>
      <p className="section-subtitle">Most-downloaded, non-suspicious picks.</p>
      <div className="grid">
        {popular.length === 0 ? (
          <div className="card">No skills yet. Be the first.</div>
        ) : (
          popular.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skillToPublic(skill)}
              summaryFallback="Agent-ready skill pack."
              meta={
                <div className="skill-card-footer-rows">
                  <UserBadge
                    user={null}
                    fallbackHandle={skill.ownerHandle ?? null}
                    prefix="by"
                    link={false}
                  />
                  <div className="stat">
                    <SkillStatsTripletLine stats={{ downloads: skill.statsDownloads, stars: skill.statsStars, versions: skill.statsVersions, comments: skill.statsComments }} />
                  </div>
                </div>
              }
            />
          ))
        )}
      </div>
      <div className="section-cta">
        <Link
          to="/skills"
          search={{
            q: undefined,
            sort: undefined,
            dir: undefined,
            highlighted: undefined,
            nonSuspicious: true,
            view: undefined,
            focus: undefined,
          }}
          className="btn"
        >
          See all skills
        </Link>
      </div>
    </section>
  )
}
