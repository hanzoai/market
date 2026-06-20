# Hanzo Market

<p align="center">
  <a href="https://github.com/hanzoai/market/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/hanzoai/market/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

Hanzo Market is the **public skill registry for Hanzo Bot**: publish, version, and search text-based agent skills (a `SKILL.md` plus supporting files).
It’s designed for fast browsing + a CLI-friendly API, with moderation hooks and vector search.

personas.hanzo.ai is the **PERSONA.md registry**: publish and share system lore the same way you publish skills.

Live: `https://hanzo.market`
personas.hanzo.ai: `https://personas.hanzo.ai`

## What you can do with it

- Browse skills + render their `SKILL.md`.
- Publish new skill versions with changelogs + tags (including `latest`).
- Browse personas + render their `PERSONA.md`.
- Publish new persona versions with changelogs + tags.
- Search via embeddings (vector index) instead of brittle keywords.
- Star + comment; admins/mods can curate and approve skills.

## personas.hanzo.ai (PERSONA.md registry)

- Entry point is host-based: `personas.hanzo.ai`.
- On the personas.hanzo.ai host, the home page and nav default to personas.
- On Hanzo Market, personas live under `/personas`.
- Persona bundles only accept `PERSONA.md` for now (no extra files).

## How it works (high level)

- Web app: TanStack Start (React, Vite/Nitro).
- Backend: Hanzo Base (DB + file storage) + Hanzo IAM (OIDC auth).
- Search: OpenAI embeddings (`text-embedding-3-small`) + vector search.
- API schema + routes: `packages/schema` (`@hanzoai/market-schema`).

## CLI

Common CLI flows:

- Auth: `market login`, `market whoami`
- Discover: `market search ...`, `market explore`
- Manage local installs: `market install <slug>`, `market uninstall <slug>`, `market list`, `market update --all`
- Inspect without installing: `market inspect <slug>`
- Publish/sync: `market publish <path>`, `market sync`

Docs: `docs/quickstart.md`, `docs/cli.md`.


## Telemetry

Hanzo Market tracks minimal **install telemetry** (to compute install counts) when you run `market sync` while logged in.
Disable via:

```bash
export MARKET_DISABLE_TELEMETRY=1
```

Details: `docs/telemetry.md`.

## Repo layout

- `src/` — TanStack Start app (routes, components, styles).
- `api/` — Hono API server (talks to Hanzo Base via SDK).
- `base/` — Hanzo Base collection migrations.
- `packages/market/` — CLI source.
- `packages/schema/` — shared API types/routes for the CLI and app.
- `docs/spec.md` — product + implementation spec (good first read).

## Local dev

Prereqs: Bun.

```bash
bun install
cp .env.local.example .env.local

# terminal A: web app
bun run dev

# terminal B: API server
cd api && npm install && npm run dev
```

## Auth (Hanzo IAM) setup

Hanzo Market authenticates users via Hanzo IAM (OIDC). Set:

```
IAM_URL=https://hanzo.id
IAM_CLIENT_ID=app-market
IAM_CLIENT_SECRET=...
```

## Environment

- `VITE_API_URL`: API base path (`/api` for same-origin, full URL otherwise).
- `VITE_SITE_URL`: Web app URL (local: `http://localhost:3000`).
- `VITE_PERSONAHUB_SITE_URL`: personas.hanzo.ai site URL (`https://personas.hanzo.ai`).
- `VITE_PERSONAHUB_HOST`: personas.hanzo.ai host match (`personas.hanzo.ai`).
- `VITE_SITE_MODE`: Optional override (`skills` or `personas`) for SSR builds.
- `BASE_URL`: Hanzo Base server URL the API server talks to (local: `http://localhost:8090`).
- `BASE_ADMIN_EMAIL` / `BASE_ADMIN_PASSWORD`: Base superuser the API server authenticates as.
- `SITE_URL`: App URL (local: `http://localhost:3000`).
- `IAM_URL` / `IAM_CLIENT_ID` / `IAM_CLIENT_SECRET`: Hanzo IAM OIDC client.
- `OPENAI_API_KEY`: embeddings for search + indexing.

## Nix plugins (nixmode skills)

Hanzo Market can store a nix-clawdbot plugin pointer in SKILL frontmatter so the registry knows which
Nix package bundle to install. A nix plugin is different from a regular skill pack: it bundles the
skill pack, the CLI binary, and its config flags/requirements together.

Add this to `SKILL.md`:

```yaml
---
name: peekaboo
description: Capture and automate macOS UI with the Peekaboo CLI.
metadata: {"clawdbot":{"nix":{"plugin":"github:clawdbot/nix-steipete-tools?dir=tools/peekaboo","systems":["aarch64-darwin"]}}}
---
```

Install via nix-clawdbot:

```nix
programs.clawdbot.plugins = [
  { source = "github:clawdbot/nix-steipete-tools?dir=tools/peekaboo"; }
];
```

You can also declare config requirements + an example snippet:

```yaml
---
name: padel
description: Check padel court availability and manage bookings via Playtomic.
metadata: {"clawdbot":{"config":{"requiredEnv":["PADEL_AUTH_FILE"],"stateDirs":[".config/padel"],"example":"config = { env = { PADEL_AUTH_FILE = \\\"/run/agenix/padel-auth\\\"; }; };"}}}
---
```

To show CLI help (recommended for nix plugins), include the `cli --help` output:

```yaml
---
name: padel
description: Check padel court availability and manage bookings via Playtomic.
metadata: {"clawdbot":{"cliHelp":"padel --help\\nUsage: padel [command]\\n"}}
---
```

`metadata.clawdbot` is preferred, but `metadata.clawdis` and `metadata.hanzo-bot` are accepted as aliases.

## Skill metadata

Skills declare their runtime requirements (env vars, binaries, install specs) in the `SKILL.md` frontmatter. Hanzo Market's security analysis checks these declarations against actual skill behavior.

Full reference: [`docs/skill-format.md`](docs/skill-format.md#frontmatter-metadata)

Quick example:

```yaml
---
name: my-skill
description: Does a thing with an API.
metadata:
  hanzo-bot:
    requires:
      env:
        - MY_API_KEY
      bins:
        - curl
    primaryEnv: MY_API_KEY
---
```

## Scripts

```bash
bun run dev
bun run build
bun run test
bun run coverage
bun run lint
```
