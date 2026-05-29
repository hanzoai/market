---
summary: 'Common setup/runtime issues (CLI + backend) and fixes.'
read_when:
  - Something is broken and you need a fix-fast checklist
---

# Troubleshooting

## `market login` opens browser but never completes

- Ensure your browser can reach `http://127.0.0.1:<port>/callback` (local firewalls/VPNs can interfere).
- Use headless mode:
  - create a token in the web UI (Settings → API tokens)
  - `market login --token clh_...`

## `whoami` / `publish` returns `Unauthorized` (401)

- Token missing or revoked: check your config file (`MARKET_CONFIG_PATH` override?).
- Ensure requests include `Authorization: Bearer ...` (CLI does this automatically).

## `publish` fails with `OPENAI_API_KEY is not configured`

- Set `OPENAI_API_KEY` in the API server environment.
- Restart the API server after setting env.

## `publish` fails with `GitHub API rate limit exceeded`

- This is the GitHub account-age gate lookup hitting unauthenticated limits.
- Set `GITHUB_TOKEN` in the API server environment to use authenticated GitHub API limits.
- Retry publish after a short wait if the limit was already exhausted.

## `sync` says “No skills found”

- `sync` looks for folders containing `SKILL.md` (or `skill.md`).
- It scans:
  - workdir first
  - then fallback roots (legacy `~/clawdis/skills`, `~/clawdbot/skills`, etc.)
- Provide explicit roots:

```bash
market sync --root /path/to/skills
```

## `update` refuses due to “local changes (no match)”

- Your local files don’t match any published fingerprint.
- Options:
  - keep local edits; skip updating
  - overwrite: `market update <slug> --force`
  - publish as fork: copy to new folder/slug then `market publish ... --fork-of upstream@version`

## `GET /api/*` works locally but not in production

- Check your reverse proxy / ingress routes `/api/*` to the API server (default port 3001).
- Ensure `VITE_API_URL` and `SITE_URL` match your deployment URLs.
