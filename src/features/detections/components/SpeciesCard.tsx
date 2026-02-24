import { getLocalizedCommonName, t } from '../../../i18n'
import { useSpeciesPhoto } from '../useSpeciesPhoto'

type SpeciesCardProps = {
  commonName: string
  scientificName: string
  count?: number
  highlight?: boolean
  onSelect?: (species: { commonName: string; scientificName: string }) => void
  onAttributionOpen?: () => void
}

const FALLBACK_WIDTH = 640
const FALLBACK_HEIGHT = 426

const SpeciesCard = ({
  commonName,
  scientificName,
  count,
  highlight = false,
  onSelect,
  onAttributionOpen,
}: SpeciesCardProps) => {
  const displayCommonName = getLocalizedCommonName(commonName, scientificName)
  const { photo, isLoading } = useSpeciesPhoto(commonName, scientificName)
  const width = photo?.width ?? FALLBACK_WIDTH
  const height = photo?.height ?? FALLBACK_HEIGHT
  const isInteractive = typeof onSelect === 'function'
  const CardTag = isInteractive ? 'div' : 'article'

  const handleSelect = () => {
    onSelect?.({ commonName: displayCommonName, scientificName })
  }

  const attributionTitle = photo?.attribution
    ? [
        photo.attribution.author ? t('attribution.author', { author: photo.attribution.author }) : null,
        photo.attribution.license ? t('attribution.license', { license: photo.attribution.license }) : null,
      ]
        .filter(Boolean)
        .join(' · ') || t('attribution.showAttribution')
    : t('attribution.showAttribution')

  return (
    <CardTag
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:bg-slate-800 dark:hover:border-slate-600 focus-within:ring-2 focus-within:ring-emerald-200 motion-safe:animate-[fadeUp_0.5s_ease] ${
        highlight
          ? 'border-emerald-200 ring-1 ring-emerald-100'
          : 'border-slate-200 dark:border-slate-700'
      } ${isInteractive ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300' : ''}`}
      onClick={isInteractive ? handleSelect : undefined}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleSelect()
              }
            }
          : undefined
      }
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        {photo ? (
          <img
            alt={t('attribution.photoOf', { name: displayCommonName })}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            decoding="async"
            height={height}
            loading="lazy"
            src={photo.url}
            width={width}
          />
        ) : isLoading ? (
          <div className="absolute inset-0 animate-pulse bg-slate-200" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <svg
                aria-hidden="true"
                className="h-10 w-10"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M10 32c6-7 12-11 18-12 5-1 8-4 10-8l4 4c-4 9-8 13-15 15-6 2-10 5-13 9l-4-8z"
                  fill="currentColor"
                  opacity="0.6"
                />
                <path
                  d="M12 26c1-6 5-10 10-13 4-2 6-4 8-7l3 3c-2 6-5 10-10 13-5 3-7 6-8 10l-3-6z"
                  fill="currentColor"
                  opacity="0.4"
                />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-[0.3em]">
                {t('common.noImage')}
              </span>
            </div>
          </div>
        )}
        {photo?.sourceUrl ? (
          <button
            className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-600 shadow-sm hover:bg-white dark:bg-slate-900/90 dark:text-slate-400 dark:hover:bg-slate-900"
            onClick={(event) => {
              event.stopPropagation()
              onAttributionOpen?.()
            }}
            title={attributionTitle}
            type="button"
          >
            ©
          </button>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4 sm:p-5">
        <div>
          <p
            className="text-base font-semibold leading-snug text-slate-900 break-words dark:text-slate-100"
            title={displayCommonName}
          >
            {displayCommonName}
          </p>
          <p
            className="text-xs text-slate-500 break-words dark:text-slate-400"
            title={scientificName}
          >
            {scientificName}
          </p>
        </div>
        {typeof count === 'number' ? (
          <span className="mt-auto inline-flex items-center self-start rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {t('common.detections', { count })}
          </span>
        ) : null}
      </div>
    </CardTag>
  )
}

export default SpeciesCard
