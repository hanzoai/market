/**
 * Brand types — thin re-export of @luxfi/brand-types.
 *
 * The canonical schema now lives in @luxfi/brand-types so that the same
 * shape can be consumed by Market, Exchange, and any other federated
 * surface without each repo re-declaring the contract.
 *
 * Importers in this codebase still write `import type { ... } from
 * './types'` / `'../brand/types'`; this shim keeps those paths stable
 * during the transition. The follow-up pass will rewrite call sites to
 * import directly from `@luxfi/brand-types` and delete this file.
 */

export type {
  AppKind,
  BrandTheme,
  BrandConfig,
  AppDescriptor,
  FederationPeer,
  ChainBinding,
  MergedBrand,
  WellKnownBrand,
  WellKnownApp,
} from '@luxfi/brand-types'
