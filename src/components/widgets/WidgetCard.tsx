import type React from 'react'

interface WidgetCardProps {
  title: string
  children: React.ReactNode
  /** Optional control on the right of the title row, e.g. a "See all" link. */
  action?: React.ReactNode
}

export function WidgetCard({ title, children, action }: WidgetCardProps) {
  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  )
}
