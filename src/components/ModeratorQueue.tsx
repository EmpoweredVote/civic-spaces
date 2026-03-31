import { useState } from 'react'
import { useModQueue, useModAction } from '../hooks/useModQueue'
import type { ModAction, FlagCategory } from '../types/database'

interface ModeratorQueueProps {
  onClose: () => void
}

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'other', label: 'Other' },
]

export default function ModeratorQueue({ onClose }: ModeratorQueueProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const { data = [], isLoading } = useModQueue({
    status: 'pending',
    category: categoryFilter || undefined,
  })
  const modAction = useModAction()

  function handleAction(action: ModAction) {
    const item = data[currentIndex]
    if (!item) return
    modAction.mutate(
      { p_action: action, p_content_id: item.content_id, p_content_type: item.content_type, p_user_id: item.author_id },
      {
        onSuccess: () => {
          // Advance to next item, wrap to 0 if at end
          setCurrentIndex((prev) => (prev >= data.length - 1 ? 0 : prev))
        },
      },
    )
  }

  const item = data[currentIndex]

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">Moderation Queue</h2>
          {!isLoading && (
            <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {data.length} in queue
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
              setCurrentIndex(0)
            }}
            className="text-sm border border-gray-300 rounded px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Close moderation queue"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            Loading queue...
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium">No flagged posts to review</p>
          </div>
        ) : item ? (
          <div className="px-4 py-4 space-y-4">
            {/* Navigation */}
            <div className="flex items-center justify-between text-sm text-gray-500">
              <button
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                aria-label="Previous item"
              >
                ←
              </button>
              <span>{currentIndex + 1} of {data.length}</span>
              <button
                onClick={() => setCurrentIndex((prev) => Math.min(data.length - 1, prev + 1))}
                disabled={currentIndex === data.length - 1}
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                aria-label="Next item"
              >
                →
              </button>
            </div>

            {/* Content card */}
            <div className="border-l-4 border-red-500 pl-4 bg-red-50 rounded-r p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded capitalize">
                  {item.content_type}
                </span>
                {item.title && <p className="font-semibold text-gray-900">{item.title}</p>}
              </div>
              <p className="text-sm text-gray-800">{item.body}</p>
              <p className="text-xs text-gray-400 mt-1">
                by {item.author_id.slice(0, 8)}... · {new Date(item.post_created_at).toLocaleDateString()}
              </p>
            </div>

            {/* Flag metadata */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                item.priority === 'high'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {item.priority === 'high' ? 'HIGH' : 'NORMAL'}
              </span>
              <span className="text-xs text-gray-500">
                {item.flag_count} flag{item.flag_count !== 1 ? 's' : ''}
              </span>
              {item.flag_categories.map((cat: FlagCategory) => (
                <span key={cat} className="text-xs bg-gray-100 px-2 py-0.5 rounded capitalize">
                  {cat}
                </span>
              ))}
              <span className="text-xs text-gray-400 ml-auto">
                First flagged {new Date(item.first_flagged_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Action bar — sticky bottom */}
      {!isLoading && data.length > 0 && (
        <div className="flex gap-2 p-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={() => handleAction('remove')}
            disabled={modAction.isPending}
            className="flex-1 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            Remove
          </button>
          <button
            onClick={() => handleAction('dismiss')}
            disabled={modAction.isPending}
            className="flex-1 py-2 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300 disabled:opacity-50 transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={() => handleAction('warn')}
            disabled={modAction.isPending}
            className="flex-1 py-2 bg-amber-400 text-amber-900 rounded text-sm font-medium hover:bg-amber-500 disabled:opacity-50 transition-colors"
          >
            Warn
          </button>
          <button
            onClick={() => handleAction('suspend')}
            disabled={modAction.isPending}
            className="flex-1 py-2 border border-red-600 text-red-600 rounded text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            Suspend
          </button>
        </div>
      )}
    </div>
  )
}
