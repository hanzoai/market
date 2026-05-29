import { getBrand } from '../brand/loader'
import { getSiteName } from '../lib/site'

export function Footer() {
  const brand = getBrand()
  const siteName = getSiteName()
  const repoHref = brand.github
  const orgHref = brand.brand.infoDomain ? `https://${brand.brand.infoDomain}` : null

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-divider" aria-hidden="true" />
        <div className="site-footer-row">
          <div className="site-footer-copy">
            {siteName}
            {orgHref ? (
              <>
                {' · A '}
                <a href={orgHref} target="_blank" rel="noreferrer">
                  {brand.brand.protocolName ?? brand.brand.shortName}
                </a>{' '}
                project
              </>
            ) : null}
            {repoHref ? (
              <>
                {' · '}
                <a href={repoHref} target="_blank" rel="noreferrer">
                  Open source (MIT)
                </a>
              </>
            ) : null}
            .
          </div>
        </div>
      </div>
    </footer>
  )
}
