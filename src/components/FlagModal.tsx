import { useState } from 'react'
import { Sheet } from 'react-modal-sheet'
import { useFlagPost } from '../hooks/useFlag'
import type { FlagCategory } from '../types/database'

interface FlagModalProps {
  contentId: string
  contentType: 'post' | 'reply'
  userId: string
  open: boolean
  onClose: () => void
}

const CATEGORIES: { value: FlagCategory; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'other', label: 'Other' },
]

export default function FlagModal({ contentId, contentType, userId, open, onClose }: FlagModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<FlagCategory | null>(null)
  const [detail, setDetail] = useState('')
  const flagPost = useFlagPost()

  function handleSubmit() {
    if (!selectedCategory) return
    flagPost.mutate(
      {
        content_id: contentId,
        content_type: contentType,
        reporter_id: userId,
        category: selectedCategory,
        detail: detail.trim() || null,
      },
      {
        onSettled: () => {
          onClose()
          setSelectedCategory(null)
          setDetail('')
        },
      },
    )
  }

  return (
    <Sheet isOpen={open} onClose={onClose} snapPoints={[0.55]} initialSnap={0}>
      <Sheet.Container>
        <Sheet.Header />
        <Sheet.Content>
          <div className="px-6 pb-8">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Report this {contentType}
            </h2>

            <div className="space-y-3">
              {CATEGORIES.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="flag-category"
                    value={value}
                    checked={selectedCategory === value}
                    onChange={() => setSelectedCategory(value)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-800">{label}</span>
                </label>
              ))}
            </div>

            {selectedCategory === 'other' && (
              <textarea
                className="mt-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                maxLength={280}
                placeholder="Tell us more (optional)"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
              />
            )}

            <button
              onClick={handleSubmit}
              disabled={!selectedCategory || flagPost.isPending}
              className="mt-5 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {flagPost.isPending ? 'Submitting…' : 'Submit report'}
            </button>
          </div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  )
}
