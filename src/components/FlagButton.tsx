import { useState } from 'react'
import { useMyFlags } from '../hooks/useFlag'
import FlagModal from './FlagModal'

interface FlagButtonProps {
  postId: string
  userId: string
}

export default function FlagButton({ postId, userId }: FlagButtonProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const { data: flaggedPosts } = useMyFlags(userId)
  const isFlagged = flaggedPosts?.has(postId) ?? false

  return (
    <>
      <button
        type="button"
        aria-label={isFlagged ? 'Already reported' : 'Report this post'}
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
        postId={postId}
        userId={userId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}
