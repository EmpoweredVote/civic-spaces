import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'wouter'
import { formatDistanceToNow } from 'date-fns'
import type { PostWithAuthor } from '../types/database'
import { isWithinEditWindow } from '../hooks/useEditPost'
import EmpoweredBadge from './EmpoweredBadge'
import FlagButton from './FlagButton'

interface PostCardProps {
  post: PostWithAuthor
  onClick: (postId: string) => void
  isOwnPost?: boolean
  currentUserId?: string
  onEdit?: (post: PostWithAuthor) => void
  onDelete?: (postId: string) => void
}

export default function PostCard({ post, onClick, isOwnPost, currentUserId, onEdit, onDelete }: PostCardProps) {
  const [, navigate] = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return

    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [menuOpen])

  if (post.is_deleted) {
    return (
      <div className="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">[Post deleted]</p>
      </div>
    )
  }

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
  const wasEdited = post.edit_history.length > 0
  const canEdit = isWithinEditWindow(post.created_at)

  return (
    <div className="relative w-full">
      <button
        className="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:shadow-md dark:hover:shadow-gray-800 transition-shadow cursor-pointer"
        onClick={() => onClick(post.id)}
      >
        {/* Top row: avatar + author info */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              navigate('/profile/' + post.user_id)
            }}
            className="flex items-center gap-3 flex-1 min-w-0 text-left"
            aria-label={`View ${post.author.display_name}'s profile`}
          >
            {post.author.avatar_url ? (
              <img
                src={post.author.avatar_url}
                alt={post.author.display_name}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {post.author.display_name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {post.author.display_name}
                </p>
                {post.author.tier === 'empowered' && <EmpoweredBadge />}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {timeAgo}
                {wasEdited && <span className="text-gray-400 dark:text-gray-500"> · edited</span>}
              </p>
            </div>
          </button>

          {/* Spacer for menu button */}
          {isOwnPost && <div className="w-8 flex-shrink-0" />}
        </div>

        {/* Post title */}
        {post.title && (
          <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
            {post.title}
          </p>
        )}

        {/* Body preview */}
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 line-clamp-4 min-h-[4.5rem]">
          {post.body}
        </p>

        {/* Bottom row: reply count + flag button */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span>
              {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}
            </span>
          </div>
          {currentUserId && !isOwnPost && (
            <FlagButton contentId={post.id} contentType="post" userId={currentUserId} />
          )}
        </div>
      </button>

      {/* "···" menu for own posts */}
      {isOwnPost && (
        <div ref={menuRef} className="absolute top-3 right-3">
          <button
            aria-label="Post options"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((prev) => !prev)
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="text-base leading-none tracking-widest">···</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-9 z-10 w-36 rounded-md bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 py-1">
              {canEdit && (
                <button
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(false)
                    onEdit?.(post)
                  }}
                >
                  Edit
                </button>
              )}
              <button
                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  if (window.confirm('Delete this post? This cannot be undone.')) {
                    onDelete?.(post.id)
                  }
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
