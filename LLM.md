# hanzoai/market — hanzo.market

Vite SPA, published by hanzoai/ci's site lane as slug `hanzo-market` (universe `infra/sites/sites.yaml`, `spa: true`). Every read and write is api.hanzo.ai `/v1`.

## Build

`bun run build` = `vite build`, then `bun scripts/pages.ts` writes the catalog into `dist/` (about 36 s, most of it the link check):

- A page per listing at `<path>/index.html` (the built shell with that page's title, description, canonical, `<link rel="alternate" type="text/markdown">`, JSON-LD and a static body inside `#root`; `createRoot` replaces the body when the app mounts), and its twin `<path>.md` (`/` -> `/index.md`).
- Shelves (`/agents` ... `/templates`), the front (`/`), shells for the private routes (`/login`, `/jobs`, `/sell/*`: noindex, empty root, a twin pointing at `/auth.md`).
- `sitemap.xml` (an index past 50,000 URLs or 50 MB), `llms.txt`, `llms-full.txt`, `404.html` (noindex app shell), `retired.json`.
- Pure logic is `src/lib/pages.ts` (under the 80% coverage gate); the script only reads, checks and writes.

Sources, read whole; one that fails or answers empty stops the build so a publish never drops pages:
`GET /v1/marketplace/shop` (seller listings: the only source with a price and an Offer), `GET /v1/catalog` (apps), `api.hanzo.ai/.well-known/agent-skills/index.json` (skills), `src/lib/personas.ts` + `public/personas/<slug>/PERSONA.md` (67 definitions), `src/lib/registry.ts` (directory agents, tools, MCP servers not in the shop), `src/lib/templates.ts`.

Not prerendered: the MCP registry mirror (`GET /v1/tool/catalog`, 51,266 servers, synced daily). One HTML per server is ~51k files re-uploaded on every JS hash change, past the 5-minute CI ceiling, and duplicates registry.modelcontextprotocol.io. Its pages stay client-rendered under spaMode; llms.txt, `/mcp` and WebMCP point at the API.

Truth rules: price and JSON-LD `offers` only for shop listings; a directory or template entry says `Shop: Not a shop listing`; reputation only from the platform (fabricated numbers removed); no CLI line the CLI lacks (persona and template commands removed). Every external link is fetched at build and dropped unless it answers 2xx (~180 of ~780 drop: template sources and previews, dead app URLs). Trusted without a fetch: URLs the build makes on api.hanzo.ai and persona dirs in hanzoai/personas.

Removed listings: the build reads the live `sitemap.xml` and `retired.json`; a path that left gets a moved page (instant meta refresh + canonical to its shelf, noindex) and a moved twin, carried in `retired.json`. A true 301 needs an edge include in universe.

## Agent files (public/)

`robots.txt` (AI crawler group, `Content-Signal: search=yes, ai-input=yes, ai-train=yes`, private paths disallowed, Sitemap; no Bytespider group, as before), `auth.md` (hanzoskills.com's text, H1 `# auth.md`), `.well-known/api-catalog` (RFC 9727; marketplace anchor). WebMCP: `src/webmcp.ts`, `search_market` + `get_listing`, read-only, feature-detected; tested in `e2e/webmcp.spec.ts` with a recording polyfill.

## Edge (universe, owned by the coordinator)

hanzo-market wants `headers: [agent-link]`, `catalog: true` (linkset type on `/.well-known/api-catalog`), `markdown` on pages, and `spaIndex: 404.html` (unknown paths get the noindex shell, not the front page's content). A real 404 needs `spa: false` + `notFound: 404.html` with a `spa` route for the dynamic app paths (`/checkout/`, `/jobs/`, `/sell/listings/`, `/l/`, `/mcp/`). Trailing-slash misses (`/x/`) already answer a bare 404; every real page answers with and without the slash.

## Test

`bun run lint && bun run typecheck && bun run coverage && bun run build` (the CI gate). `bunx playwright test` (dev server, platform mocked). `buyer.spec.ts` "browse → listing" has been red since c0d7773 (catalog counts changed with the personas shelf).
