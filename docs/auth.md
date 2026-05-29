---
summary: 'Auth overview: Hanzo IAM OIDC (web) + API tokens (CLI).'
read_when:
  - Working on login/token flows
  - Debugging 401s
---

# Auth

## Web auth (Hanzo IAM)

- Hanzo IAM is the only supported identity provider (OIDC).
- Env vars:
  - `IAM_URL` (default `https://hanzo.id`)
  - `IAM_CLIENT_ID`
  - `IAM_CLIENT_SECRET`
  - `SITE_URL` (used by auth callback)

Local setup steps are in the repo root `README.md`.

## API tokens (CLI)

The CLI uses a long-lived API token (Bearer token) for publish/sync/delete.

### Browser flow (default)

`market login` does:

1. Starts a loopback HTTP server on `127.0.0.1` (random port).
2. Opens `<site>/cli/auth?redirect_uri=http://127.0.0.1:<port>/callback&state=...`.
3. Web UI requires Hanzo IAM login, then creates a token and redirects back to the loopback server.
4. CLI stores the token in the global config file.

### Headless flow

Create a token in the web UI (Settings → API tokens) and paste it:

```bash
market login --token clh_...
```

### Token storage

Default global config path:

- macOS: `~/Library/Application Support/market/config.json`

Override:

- `MARKET_CONFIG_PATH=/path/to/config.json` (legacy `BOTHUB_CONFIG_PATH`, `CLAWDHUB_CONFIG_PATH`)

### Revocation

- Tokens can be revoked in the web UI.
- Revoked tokens return `401 Unauthorized` on CLI endpoints.
