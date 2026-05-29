import { useMemo, useState } from 'react'
import { getBrand } from '../brand/loader'

type PackageManager = 'npm' | 'pnpm' | 'bun'

type InstallSwitcherProps = {
  exampleSlug?: string
}

const PACKAGE_MANAGERS: Array<{ id: PackageManager; label: string }> = [
  { id: 'npm', label: 'npm' },
  { id: 'pnpm', label: 'pnpm' },
  { id: 'bun', label: 'bun' },
]

function getCliPackageName() {
  const brand = getBrand()
  // Hanzo brand publishes the CLI as `@hanzoai/market`; other brands set
  // brand.brand.name to choose their own org. Fork-friendly default: `market`.
  const orgName = brand.brand.name?.trim()
  if (orgName === 'hanzo') return '@hanzoai/market'
  if (!orgName || orgName === 'generic') return 'market'
  return `@${orgName}/market`
}

export function InstallSwitcher({ exampleSlug = 'sonoscli' }: InstallSwitcherProps) {
  const [pm, setPm] = useState<PackageManager>('npm')
  const pkg = useMemo(() => getCliPackageName(), [])

  const command = useMemo(() => {
    switch (pm) {
      case 'npm':
        return `npx ${pkg}@latest install ${exampleSlug}`
      case 'pnpm':
        return `pnpm dlx ${pkg}@latest install ${exampleSlug}`
      case 'bun':
        return `bunx ${pkg}@latest install ${exampleSlug}`
    }
  }, [exampleSlug, pkg, pm])

  return (
    <div className="install-switcher">
      <div className="install-switcher-row">
        <div className="stat">Install any skill folder in one shot:</div>
        <div className="install-switcher-toggle" role="tablist" aria-label="Install command">
          {PACKAGE_MANAGERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={
                pm === entry.id ? 'install-switcher-pill is-active' : 'install-switcher-pill'
              }
              role="tab"
              aria-selected={pm === entry.id}
              onClick={() => setPm(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
      <div className="hero-install-code mono">{command}</div>
    </div>
  )
}
