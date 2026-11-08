# hanzo.market

The Hanzo marketplace: one catalog of agents, apps, skills and MCP servers, for
the people who buy them, the organizations that sell them, and the experts who
can be booked.

It is a static storefront. `vite build` writes `dist/`; the site lane in
[hanzoai/ci](https://github.com/hanzoai/ci) publishes it to the sites plane, and
the edge serves it at https://hanzo.market. There is no server in this repo:
every read and write is an api.hanzo.ai `/v1` operation. Sign-in is Hanzo IAM
on this site's own `/login` (`@hanzo/ui/auth`'s `SignIn`, code + PKCE through
`@hanzo/iam`): the edge answers IAM's credential and sign-out routes on
hanzo.market, so nobody is sent to hanzo.id. Our stream, the ad tags and consent
are `@hanzo/event` (`src/analytics.tsx`): the tags are the project's tag set in
cloud, loaded only as consent allows.

## Buyers

- Browse and search one catalog, faceted by type: `/`, `/agents`, `/experts`,
  `/apps`, `/skills`, `/mcp`.
- A listing page (`/l/:id`, `/apps/:org/:name`, `/skills/:name`, `/mcp/:id`)
  shows reputation, how to get it, and the same action as a docs link, a
  `hanzo` CLI line and a hanzo-mcp tool call.
- Experts (`/experts`): people, not software. The category lists every expert
  (the shop read 200 at a time until its total), filtered by area (`area=`) and
  searched. An expert's page (`/experts/:id`, also `/l/:id` for that kind) shows
  their areas, rate and/or fixed price, languages, time zone, availability and
  reviews, and **Book** opens the same checkout as hiring an agent: the amount
  opens at the fixed price, else one hour of the rate.
- Checkout (`/checkout/:id?rail=x402|escrow`) runs clearance first and says what
  it needs in plain words, including backup withholding; then it installs for
  per-call payment over x402, or funds an on-chain escrow job.
- Jobs (`/jobs`, `/jobs/:id`): open → accepted → delivered → released or
  disputed.

## Sellers

- `/experts/join`: any signed-in member lists themself as an expert (`kind:
  "expert"`, no `tool`), or edits the listing they have: one per person, so a
  second create answers 409. A positive rate or price needs the org's payout
  wallet, chosen as `/sell/listings` chooses it. Signed out, it goes through
  `/login` and returns to the form. `verified` is the platform staff's word and
  is read-only here.
- `/sell`: the organization as principal — identity verification, W-9 or W-8,
  payout wallet.
- `/sell/listings`: create and edit listings of each type from the org's own
  agents, apps, skills and MCP servers.
- `/sell/jobs`: the escrow inbox. `/sell/earnings`: x402 settlements, escrow
  released and held, and the 1099s received.

## Develop

```bash
bun install
bun run dev          # http://localhost:3330, /v1 proxied to api.hanzo.ai
bun run lint         # oxlint (type-aware) + hanzo-design-lint
bun run typecheck
bun run coverage     # vitest, 80% threshold on src/lib
bun run build        # dist/
bun run test:e2e     # Playwright against the dev server, platform mocked
BASE_URL=https://hanzo.market bun run test:e2e   # read-only @live specs
```

The design system is Hanzo's: `@hanzo/ui` on `@hanzo/gui`, `@hanzo/design`
tokens, and the shared `@hanzogui/shell` header and footer.

## License

MIT
