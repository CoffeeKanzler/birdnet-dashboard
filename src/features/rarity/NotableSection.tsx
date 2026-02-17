import { siteConfig } from '../../config/site'
import { getSpeciesData, t } from '../../i18n'
import { type NotableSpotlight } from './useNotableSpotlight'

type NotableSectionProps = {
  matches: NotableSpotlight[]
  isLoading: boolean
  error: string | null
  rangeSummary: string
  regionLabel: string
}

const NotableSection = ({
  matches,
  isLoading,
  error,
  rangeSummary,
  regionLabel,
}: NotableSectionProps) => {
  const hasMatches = matches.length > 0

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t('notable.sectionLabel')}
          </p>
          <h2 className="text-xl font-semibold text-slate-900">
            {t('notable.heading')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('notable.curatedFor', { region: regionLabel, range: rangeSummary })}
          </p>
        </div>
      </header>

      <div className="mt-5 space-y-3">
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        {isLoading && matches.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            {t('notable.loading')}
          </div>
        ) : !hasMatches ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
            {t('notable.noResults')}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {matches.map((match) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                key={match.species.commonName}
              >
                <div className="min-w-0">
                  {(() => {
                    const localeData = getSpeciesData(match.species.scientificName ?? '')
                    const description = localeData.description || match.species.description
                    const whyNotable = localeData.whyNotable || match.species.whyNotable
                    const displayName = localeData.commonName || match.species.commonName
                    return (
                      <>
                        <p className="text-sm font-semibold text-slate-900">
                          {displayName}
                        </p>
                        {match.species.scientificName ? (
                          <p className="text-xs text-slate-500">
                            {match.species.scientificName}
                          </p>
                        ) : null}
                        {description ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {description}
                          </p>
                        ) : null}
                        {whyNotable?.length ? (
                          <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
                            {t('notable.whyNotable', { reasons: whyNotable.join(' · ') })}
                          </p>
                        ) : null}
                      </>
                    )
                  })()}
                </div>
                <div className="text-right text-xs text-slate-400">
                  <p>
                    {match.detectionCount} {match.detectionCount === 1 ? t('common.detection') : t('common.detectionPlural')}
                  </p>
                  <p>
                    {t('notable.lastSeen', { date: match.lastSeenAt ? match.lastSeenAt.toLocaleDateString(siteConfig.dateLocale) : t('common.unknown') })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default NotableSection
