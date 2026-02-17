type RangeLoadingPanelProps = {
  title: string
  subtitle?: string
}

const RangeLoadingPanel = ({ title, subtitle }: RangeLoadingPanelProps) => {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/90 sm:p-8">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative h-10 w-10">
            <span className="absolute inset-0 rounded-full border-2 border-emerald-200/80 dark:border-emerald-500/30" />
            <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-500 animate-spin" />
            <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
              {title}
            </p>
            {subtitle ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          {[85, 68, 92, 74, 58].map((width, index) => (
            <div
              className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
              key={index}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-teal-300 to-sky-300 dark:from-emerald-600/60 dark:via-teal-600/60 dark:to-sky-600/60 motion-safe:animate-pulse"
                style={{ width: `${width}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default RangeLoadingPanel
