import type React from 'react'

interface WidgetCardProps {
  title: string
  children: React.ReactNode
}

export function WidgetCard({ title, children }: WidgetCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
        {title}
      </h3>
      {children}
    </div>
  )
}
