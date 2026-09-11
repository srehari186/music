import type { ReactNode } from 'react'

/**
 * Shared page header — same icon + title + subtitle language as the Home
 * section headers, so every section looks like one app on any screen size.
 */
export function PageHeader({
  icon,
  title,
  subtitle,
  action
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-panel">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-xs text-white/50 sm:text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
