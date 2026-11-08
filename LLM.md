# hanzoai/market — hanzo.market

Vite SPA, published by hanzoai/ci's site lane as slug `hanzo-market` (universe `infra/sites/sites.yaml`, `spa: true`). Every read and write is api.hanzo.ai `/v1`.

## Build

`bun run build` = `vite build`, then `bun scripts/pages.ts` writes the catalog into `dist/` (about 36 s, most of it the link check):

- A page per listing at `<path>/index.html` (the built shell with that page's title, description, canonical, `<link rel="alternate" type="text/markdown">`, JSON-LD and a static body inside `#root`; `createRoot` replaces the body when the app mounts), and its twin `<path>.md` (`/` -> `/index.md`).
- Shelves (`/agents`, `/experts` ... `/templates`; an expert's page is `/experts/<id>`, a `Service` in JSON-LD with an hourly and/or fixed `Offer`), the front (`/`), shells for the private routes (`/login`, `/jobs`, `/experts/join`, `/sell/*`: noindex, empty root, a twin pointing at `/auth.md`).
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

hanzo-market wants `headers: [agent-link]`, `catalog: true` (linkset type on `/.well-known/api-catalog`), `markdown` on pages, and `spaIndex: 404.html` (unknown paths get the noindex shell, not the front page's content). A real 404 needs `spa: false` + `notFound: 404.html` with a `spa` route for the dynamic app paths (`/checkout/`, `/jobs/`, `/sell/listings/`, `/l/`, `/experts/`, `/mcp/`). Trailing-slash misses (`/x/`) already answer a bare 404; every real page answers with and without the slash.

## Test

`bun run lint && bun run typecheck && bun run coverage && bun run build` (the CI gate). `bunx playwright test` (dev server, platform mocked).

## Experts

A listing of kind `expert` is a person, hired through the existing job flow (`POST /v1/marketplace/jobs`); there is no second job or payment path. `src/lib/expert.ts` holds everything that is not a screen: the closed area list and labels (`configure`, `base`, `commerce`, `bot`, `agents`, `cloud`, `models`, `creative`, `freelance`), the form's validation (`check`) and the exact create/patch bodies (`create`, `change`: no `tool`, `public: true`, `expert` replaced whole), the shop pager (`every`: 200 a time until `total`), and `mine` (the caller's own listing is the row of kind `expert` whose `expert.self` the platform set true on `GET /v1/marketplace/listings` and on the create and patch responses; it is omitted for a colleague's listing in the same org, and shop reads carry neither `self` nor a person). `src/pages/experts.tsx` is the category and the card, `Person` in `src/pages/item.tsx` the page (so `/experts/:id` and `/l/:id` are one route component), `src/pages/join.tsx` the form. Checkout opens an expert's hire at `opening()`: the fixed price, else one hour of the rate. `verified` is staff-set and never sent.

## Sign-in

`/login` and `/signup` are `src/login.tsx`: `@hanzo/ui/auth`'s `SignIn` (frame on: its own brand row, heading and "New to Hanzo Market?" line) inside `Area`, a page area at least `100dvh - BAR` (`BAR` = the shell's 60px bar, `src/chrome.tsx`) that grows with the card, so the footer follows it and never overlaps. A fixed `minH` on the area (it was 480 under a 560 card) clipped the sign-up line behind the footer and pushed the card to the top; `e2e/login.spec.ts` holds it at 375/768/1440. The site wears `<Hanzo theme="dark">` in both colour schemes.

The account chooser hanzo.ai draws on /login (every account IAM lists at `GET /v1/iam/accounts`, switch, sign out one or all) is not in a package this site can import: the view is hanzo-inc/app `components/auth/choose.tsx` and its bar menu `components/shell/account-widget.tsx`; the behaviour is `@hanzo/app/lib/accounts` (`useAccounts`, from 0.3.50), which is bound to hanzo.ai's hosts (`lib/host` `answers()` names the apex, test.hanzo.ai and localhost, so on hanzo.market it would call hanzo.id cross-origin) and imports `@hanzo/build/route`. `@hanzo/ui/auth` and `@hanzo/iam` (`resume(sub)`) have no chooser.

## Connect, the short card, the record

`/experts/join` is one short card (`src/pages/join.tsx`), filled from what is known and empty where nothing is: `src/lib/expert.ts` `start` (this browser's zone and languages, `~/lib/github` `spoken`) and, when IAM has a GitHub identity linked, GitHub's public record (`~/lib/github` `pull`: `GET api.github.com/user/{id}` by the numeric id `GET /v1/iam/linked-accounts` gives, then `/users/{login}/repos`, then `raw.githubusercontent.com/{repo}/HEAD/package.json|go.mod` of the ten latest own repositories). Proposed, never invented: name, bio, skills (top languages of their own non-fork repos, then topics), areas (a Hanzo or Lux dependency: `PRODUCT` table in github.ts, any other one is `freelance`), links (profile, blog, most-starred repos: the public REST API does not say which are pinned), a zone guessed from the location (`zoneOf`). One rate (`Form.fee` toggles hourly or fixed; the other is cleared), availability is a chip (`HOURS`) and a note joined as `Part-time · note` (`availability`/`hoursOf`).

Connecting is IAM's: `POST /v1/iam/link` on this origin (`~/lib/linked` `connect`, body `{provider: "provider-github", clientId, returnUri: <origin>/auth/callback}`), then the browser goes where IAM says and comes back to `/auth/callback?linked=<provider>` or `?error&error_description`; `callback.tsx` sees the return only while a connect is under way (`remember`/`returned`/`back`) and sends the person back with IAM's reason in router state. Prefill needs the identity already linked; a person who signed in with GitHub has it. LinkedIn is not an IAM provider of `hanzo-market` (`GET /v1/iam/auth/methods?clientId=hanzo-market`: GitHub and Google only), so there is no LinkedIn button.

Refresh (`Refresh` in `pages/item.tsx`): on the caller's own expert page, `refresh()` diffs GitHub's record against the listing (name, bio, skills, links, areas added) and writes nothing until Save; zone and week are the person's and are not touched.

The record: `expert.reward` (level, levelName, points, tier, three rarest badges, pillars), `expert.products` and `expert.top` ride on cloud's shop rows (`apps/marketplace`), only for an expert whose reward profile is public; absent otherwise, and the card draws nothing for them (`pages/standing.tsx`). The card's checkbox "Show my Hanzo level and badges" is drawn only where `GET /v1/reward/me/profile` answers; ticked by default for a member with no profile, the member's own choice once they have one; it writes `PUT /v1/reward/me/profile` `{handle, public, links}` before the listing (handle: the one held, else the GitHub login, else the name; 409 is said).

## Directory

`/experts` keeps its view in the address (`shelf`/`asked`/`keep` in `lib/expert.ts`): `q area sort dir language verified minLevel badge tokenTier rateMin rateMax product`; what this list does not know is not asked. Each change starts from `window.location.search`, never from the render's params (a router applies a change a moment late). The shop orders and pages; the storefront reads every page in the order given (`every`). A product ranks by its own score, so choosing one drops `sort`.
