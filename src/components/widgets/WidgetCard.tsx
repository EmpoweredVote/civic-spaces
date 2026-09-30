import type React from 'react'

interface WidgetCardProps {
  title: string
  children: React.ReactNode
}

export function WidgetCard({ title, children }: WidgetCardProps) {
  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-gray-900 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-3">
        {title}
      </h3>
      {children}
    </div>
  )
}
