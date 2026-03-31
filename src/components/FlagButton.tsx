import { useState } from 'react'
import { useMyFlags } from '../hooks/useFlag'
import FlagModal from './FlagModal'

interface FlagButtonProps {
  contentId: string
  contentType: 'post' | 'reply'
  userId: string
}

export default function FlagButton({ contentId, contentType, userId }: FlagButtonProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const { data: flaggedContent } = useMyFlags(userId)
  const isFlagged = flaggedContent?.has(contentId) ?? false

  return (
    <>
      <button
        type="button"
        aria-label={isFlagged ? 'Already reported' : `Report this ${contentType}`}
        onClick={(e) => {
          e.stopPropagation()
          if (!isFlagged) setModalOpen(true)
        }}
        className={`p-1 rounded transition-colors ${
          isFlagged
            ? 'text-red-500 cursor-default'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        }`}
      >
        {isFlagged ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 21V4m0 0l6-1.5L15 4l6-1.5V16.5L15 18l-6-1.5L3 16.5z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V4m0 0l6-1.5L15 4l6-1.5V16.5L15 18l-6-1.5L3 16.5" />
          </svg>
        )}
      </button>
      <FlagModal
        contentId={contentId}
        contentType={contentType}
        userId={userId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}
