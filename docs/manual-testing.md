---
summary: 'Copy/paste CLI smoke checklist for local verification.'
read_when:
  - Pre-merge validation
  - Reproducing a reported CLI bug
---

# Manual testing (CLI)

## Setup
- Ensure logged in: `bun market whoami` (or `bun market login`).
- Optional: set env
  - `MARKET_SITE=https://hanzo.market`
  - `MARKET_REGISTRY=https://hanzo.market`

## Smoke
- `bun market --help`
- `bun market --cli-version`
- `bun market whoami`

## Search
- `bun market search gif --limit 5`

## Install / list / update
- `mkdir -p /tmp/market-manual && cd /tmp/market-manual`
- `bunx @hanzoai/market@beta install gifgrep --force`
- `bunx @hanzoai/market@beta list`
- `bunx @hanzoai/market@beta update gifgrep --force`

## Publish (changelog optional)
- `mkdir -p /tmp/market-skill-demo/SKILL && cd /tmp/market-skill-demo`
- Create files:
  - `SKILL.md`
  - `notes.md`
- Publish:
  - `bun market publish . --slug market-manual-<ts> --name "Manual <ts>" --version 1.0.0 --tags latest`
- Publish update with empty changelog:
  - `bun market publish . --slug market-manual-<ts> --name "Manual <ts>" --version 1.0.1 --tags latest`

## Delete / undelete (owner/admin)
- `bun market delete market-manual-<ts> --yes`
- Verify hidden:
- `curl -i "https://hanzo.market/api/v1/skills/market-manual-<ts>"`
- Restore:
  - `bun market undelete market-manual-<ts> --yes`
- Cleanup:
  - `bun market delete market-manual-<ts> --yes`

## Sync
- `bun market sync --dry-run --all`

## Playwright (menu smoke)

Run against prod:

```
PLAYWRIGHT_BASE_URL=https://hanzo.market bun run test:pw
```

Run against a local preview server:

```
bun run test:e2e:local
```
