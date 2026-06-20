---
summary: 'Deploy checklist: API server + web app + /api routing.'
read_when:
  - Shipping to production
  - Debugging /api routing
---

# Deploy

Hanzo Market is three deployables shipped as one image:

- Web app (TanStack Start / Nitro) on port 3000.
- API server (Hono) on port 3001.
- Hanzo Base (collections + storage) on port 8090.

All three are started by `docker-entrypoint.sh`.

## 1) Build the image

```bash
docker build -t ghcr.io/hanzoai/market:latest .
```

CI/CD pushes to `ghcr.io/hanzoai/market`.

## 2) Configure secrets

K8s manifests are in `k8s/`. Required secrets in `market-secrets`:

- `BASE_URL` (Hanzo Base server, e.g. `http://localhost:8090`)
- `BASE_ADMIN_EMAIL` / `BASE_ADMIN_PASSWORD` (Base superuser)
- `IAM_CLIENT_ID` (default `app-market`)
- `IAM_CLIENT_SECRET`
- `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- `OPENAI_API_KEY`
- Optional: `GITHUB_TOKEN` (recommended; raises GitHub account lookup limit used by publish gate)
- Optional webhook env (see `docs/webhook.md`)

## 3) Deploy to K8s

```bash
kubectl apply -f k8s/
```

The ingress routes `hanzo.market` → service `market` (port 80 → web, port 3001 → API).

## 4) Registry discovery

The CLI can discover the API base from:

- `/.well-known/bothub.json` (legacy filename retained for older CLIs)

If you don’t serve that file, users must set:

```bash
export MARKET_REGISTRY=https://your-site.example
```

## 5) Post-deploy checks

```bash
curl -i "https://<site>/api/v1/search?q=test"
curl -i "https://<site>/api/v1/skills/gifgrep"
```

Then:

```bash
market login --site https://<site>
market whoami
```
