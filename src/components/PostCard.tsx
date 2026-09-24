import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'wouter'
import { formatDistanceToNow } from 'date-fns'
import type { PostWithAuthor } from '../types/database'
import { isWithinEditWindow } from '../hooks/useEditPost'
import EmpoweredBadge from './EmpoweredBadge'
import FlagButton from './FlagButton'
import { toast } from 'sonner'

interface PostCardProps {
  post: PostWithAuthor
  onClick: (postId: string) => void
  isOwnPost?: boolean
  currentUserId?: string
  onEdit?: (post: PostWithAuthor) => void
  onDelete?: (postId: string) => void
}

const ACTION =
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40'

function CommentIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l5 5-5 5M20 10h-7a8 8 0 00-8 8v1" />
    </svg>
  )
}

/**
 * The line the card leads with. A post's title when it has one; otherwise the author's
 * own first sentence (not a summary we write), with the rest as the excerpt. A first
 * sentence too long to be a headline is left whole and simply clamped.
 */
function splitHeadline(title: string | null, body: string): { headline: string; excerpt: string } {
  if (title?.trim()) return { headline: title.trim(), excerpt: body.trim() }
  const text = body.trim()
  const match = text.match(/^(.+?[.!?])(\s+|$)/)
  if (match && match[1]!.length <= 160) {
    return { headline: match[1]!, excerpt: text.slice(match[0].length).trim() }
  }
  return { headline: text, excerpt: '' }
}

/**
 * A thread's URL is the only URL the feed has (CLAUDE.md): /post/:postId resolves
 * through locatePost for members, and a signed-out visitor's link is stashed and
 * replayed after login. The OS share sheet where there is one, else the clipboard.
 */
async function sharePost(postId: string, headline: string) {
  const url = `${window.location.origin}/post/${postId}`
  try {
    if (navigator.share) {
      await navigator.share({ title: headline, url })
      return
    }
    await navigator.clipboard.writeText(url)
    toast.success('Link copied')
  } catch (err) {
    // Dismissing the share sheet rejects with AbortError — not a failure.
    if ((err as Error)?.name !== 'AbortError') toast.error("Couldn't share this post")
  }
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
        <p className="text-sm text-gray-500 dark:text-gray-500 italic">[Post deleted]</p>
      </div>
    )
  }

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
  const wasEdited = post.edit_history.length > 0
  const canEdit = isWithinEditWindow(post.created_at)

  const { headline, excerpt } = splitHeadline(post.title, post.body)
  const openThread = () => onClick(post.id)

  return (
    <article className="relative w-full rounded-xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-gray-900 px-4 pt-3.5 pb-2 hover:border-gray-300 dark:hover:border-white/15 transition-colors">
      {/* Byline: author, badge, time — one quiet line, so the headline leads. */}
      <div className={`flex items-center gap-2 min-w-0 ${isOwnPost ? 'pr-9' : ''}`}>
        <button
          type="button"
          onClick={() => navigate('/profile/' + post.user_id)}
          className="relative z-10 flex items-center gap-2 min-w-0 rounded-full hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          aria-label={`View ${post.author.display_name}'s profile`}
        >
          {post.author.avatar_url ? (
            <img
              src={post.author.avatar_url}
              alt=""
              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <span className="w-7 h-7 rounded-full bg-brand-muted dark:bg-brand/20 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-brand dark:text-brand-light" aria-hidden="true">
              {post.author.display_name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {post.author.display_name}
          </span>
        </button>
        {post.author.tier === 'empowered' && <EmpoweredBadge />}
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0" aria-hidden="true">·</span>
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          {timeAgo}
          {wasEdited && ' · edited'}
        </span>
      </div>

      {/* The main topic. Its button is the card's link: the ::after stretches it over the
          whole card, so clicking anywhere opens the thread, while the byline, menu and
          footer controls sit above it (z-10) as real, separate buttons — no button
          nested in a button, which the old whole-card <button> was. */}
      <h3 className="mt-2 text-base font-bold leading-snug text-gray-900 dark:text-gray-50">
        <button
          type="button"
          onClick={openThread}
          className="text-left after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand/40 line-clamp-3"
        >
          {headline}
        </button>
      </h3>

      {excerpt && (
        <p className="mt-1 text-[13px] leading-relaxed text-gray-600 dark:text-gray-400 line-clamp-2">
          {excerpt}
        </p>
      )}

      {/* Footer actions — each one real: the thread, the thread's own URL, and a report. */}
      <div className="mt-2 -ml-2.5 flex items-center gap-1">
        <button type="button" onClick={openThread} className={`relative z-10 ${ACTION}`}>
          <CommentIcon />
          {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}
        </button>
        <button type="button" onClick={() => sharePost(post.id, headline)} className={`relative z-10 ${ACTION}`}>
          <ShareIcon />
          Share
        </button>
        {currentUserId && !isOwnPost && (
          <span className="relative z-10 ml-auto">
            <FlagButton contentId={post.id} contentType="post" userId={currentUserId} />
          </span>
        )}
      </div>

      {/* "···" menu for own posts */}
      {isOwnPost && (
        <div ref={menuRef} className="absolute top-3 right-3 z-10">
          <button
            aria-label="Post options"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((prev) => !prev)
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
    </article>
  )
}
