/**
 * Brand types — local mirror of @luxfi/brand schema.
 *
 * Replace this file with `import type { ... } from '@luxfi/brand'` once that
 * package is published. The shape is intentionally identical.
 */

export type AppKind = 'market' | 'exchange' | 'explore' | 'bridge' | 'mpc' | 'base' | 'iam'

export interface BrandTheme {
  accent1?: string
  accent1Hovered?: string
  accent2?: string
  accent3?: string
  surface1?: string
  surface2?: string
  surface3?: string
  neutral1?: string
  neutral2?: string
  neutral3?: string
  neutralContrast?: string
  background?: string
  statusSuccess?: string
  statusCritical?: string
  statusWarning?: string
  scrim?: string
}

export interface BrandConfig {
  name: string
  title: string
  shortName: string
  description: string
  legalEntity?: string
  walletName?: string
  protocolName?: string
  copyrightHolder?: string
  appDomain: string
  docsDomain?: string
  infoDomain?: string
  gatewayDomain?: string
  wsDomain?: string
  helpUrl?: string
  termsUrl?: string
  privacyUrl?: string
  complianceEmail?: string
  supportEmail?: string
  twitter?: string
  github?: string
  discord?: string
  primaryColor?: string
  defaultChainId?: number
  supportedChainIds?: number[]
  theme?: { light?: BrandTheme; dark?: BrandTheme }
}

export interface AppDescriptor {
  id: AppKind
  name: string
  tagline: string
  description: string
  iconPath?: string
  defaultSubdomain: string
}

export interface FederationPeer {
  id: string
  url: string
  appId?: AppKind
}

export interface ChainBinding {
  id: number
  name: string
  rpcUrl: string
  explorerUrl: string
  registryContract?: `0x${string}`
}

export interface MergedBrand {
  brandId: string
  appId: AppKind
  brand: BrandConfig
  app: AppDescriptor
  title: string
  domain: string
  url: string
  github: string
  chain?: ChainBinding
  peers: FederationPeer[]
}
