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
            Lokale besondere Sichtungen
          </p>
          <h2 className="text-xl font-semibold text-slate-900">
            Besondere Arten im Zeitraum
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Kuratiert fuer {regionLabel} · {rangeSummary}
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
            Besondere Sichtungen werden geladen...
          </div>
        ) : !hasMatches ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
            Noch keine besonderen Sichtungen in diesem Zeitraum gefunden.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {matches.map((match) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                key={match.species.commonName}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {match.species.commonName}
                  </p>
                  {match.species.scientificName ? (
                    <p className="text-xs text-slate-500">
                      {match.species.scientificName}
                    </p>
                  ) : null}
                  {match.species.description ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {match.species.description}
                    </p>
                  ) : null}
                  {match.species.whyNotable?.length ? (
                    <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Warum bemerkenswert: {match.species.whyNotable.join(' · ')}
                    </p>
                  ) : null}
                </div>
                <div className="text-right text-xs text-slate-400">
                  <p>
                    {match.detectionCount} Sichtung
                    {match.detectionCount === 1 ? '' : 'en'}
                  </p>
                  <p>
                    Zuletzt gesehen{' '}
                    {match.lastSeenAt
                      ? match.lastSeenAt.toLocaleDateString('de-DE')
                      : 'Unbekannt'}
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
