---
summary: 'Local setup + CLI smoke: login, search, install, publish, sync.'
read_when:
  - First run / local dev setup
  - Verifying end-to-end flows
---

# Quickstart

## 0) Prereqs

- Bun
- Hanzo IAM client (for login)
- OpenAI key (for embeddings/search)

## 1) Local dev (web + API)

```bash
bun install
cp .env.local.example .env.local

# terminal A: web app
bun run dev

# terminal B: API server
cd api && npm install && npm run dev
```

## 2) Auth setup (Hanzo IAM OIDC)

Fill in `.env.local`:

- `IAM_URL` (default `https://hanzo.id`)
- `IAM_CLIENT_ID`
- `IAM_CLIENT_SECRET`
- `VITE_API_URL=/api`
- `VITE_SITE_URL=http://localhost:3000`
- `SITE_URL=http://localhost:3000`
- `OPENAI_API_KEY`
- `DATABASE_URL`

## 3) CLI: login + basic commands

From this repo:

```bash
bun market --help
bun market login
bun market whoami
bun market search gif --limit 5
```

Install a skill into `./skills/<slug>` (if Hanzo Bot is configured, installs into that workspace instead):

```bash
bun market install <slug>
bun market list
bun market uninstall <slug> --yes
```

You can also install into any folder:

```bash
bun market install <slug> --workdir /tmp/market-demo --dir skills
```

Update:

```bash
bun market update --all
```

## 4) Publish a skill

Create a folder containing `SKILL.md` (required) plus any supporting text files:

```bash
mkdir -p /tmp/market-skill-demo && cd /tmp/market-skill-demo
cat > SKILL.md <<'EOF'
---
name: Demo Skill
description: Demo skill for local testing
---

# Demo Skill

Hello.
EOF
```

Publish:

```bash
bun market publish . \
  --slug market-demo-$(date +%s) \
  --name "Demo $(date +%s)" \
  --version 1.0.0 \
  --tags latest \
  --changelog "Initial release"
```

## 5) Sync local skills (auto-publish new/changed)

`sync` scans for local skill folders and publishes the ones that aren’t “synced” yet.

```bash
bun market sync
```

Dry run + non-interactive:

```bash
bun market sync --all --dry-run --no-input
```
