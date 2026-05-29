# `@hanzoai/market`

Hanzo Market CLI — install, update, search, and publish agent skills as folders.

## Install

```bash
# From this repo (shortcut script at repo root)
bun market --help

# Once published to npm
# npm i -g @hanzoai/market
```

## Auth (publish)

```bash
market login
# or
market auth login

# Headless / token paste
# or (token paste / headless)
market login --token clh_...
```

Notes:

- Browser login opens `https://hanzo.market/cli/auth` and completes via a loopback callback.
- Token stored in `~/Library/Application Support/market/config.json` on macOS (override via `MARKET_CONFIG_PATH`, legacy `BOTHUB_CONFIG_PATH` / `CLAWDHUB_CONFIG_PATH`).

## Examples

```bash
market search "postgres backups"
market install my-skill-pack
market update --all
market update --all --no-input --force
market publish ./my-skill-pack --slug my-skill-pack --name "My Skill Pack" --version 1.2.0 --changelog "Fixes + docs"
```

## Sync (upload local skills)

```bash
# Start anywhere; scans workdir first, then legacy bot install locations.
market sync

# Explicit roots + non-interactive dry-run
market sync --root ../clawdis/skills --all --dry-run
```

## Defaults

- Site: `https://hanzo.market` (override via `--site` or `MARKET_SITE`, legacy `BOTHUB_SITE` / `CLAWDHUB_SITE`)
- Registry: discovered from `/.well-known/bothub.json` on the site (legacy filename retained for older CLIs; override via `--registry` or `MARKET_REGISTRY`)
- Workdir: current directory (falls back to Hanzo Bot workspace if configured; override via `--workdir` or `MARKET_WORKDIR`)
- Install dir: `./skills` under workdir (override via `--dir`)
