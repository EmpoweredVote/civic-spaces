import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'wouter'
import { formatDistanceToNow } from 'date-fns'
import { useThread } from '../hooks/useThread'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import ReplyCard from './ReplyCard'
import ReplyComposer from './ReplyComposer'
import InformUpgradePrompt from './InformUpgradePrompt'
import EmpoweredBadge from './EmpoweredBadge'
import type { ReplyWithAuthor } from '../types/database'

interface ThreadViewProps {
  postId: string
  onBack: () => void
  sliceId: string
  scrollToLatest?: boolean
  /** True when this thread belongs to a sibling slice the user is browsing, not their own. */
  isViewOnly?: boolean
  /** The user's own slice number for this location — used in the view-only explanation. */
  ownSliceIndex?: number
}

interface ReplyTarget {
  replyId: string
  authorName: string
}

export default function ThreadView({ postId, onBack, scrollToLatest, isViewOnly = false, ownSliceIndex }: ThreadViewProps) {
  const [, navigate] = useLocation()
  const { post, replies, fetchMoreReplies, hasMoreReplies, isLoading } = useThread(postId)
  const { userId } = useAuth()
  const { profile } = useProfile(userId)

  const [activeReplyTarget, setActiveReplyTarget] = useState<ReplyTarget | null>(null)
  const [replyComposerOpen, setReplyComposerOpen] = useState(false)
  const replyListRef = useRef<HTMLDivElement>(null)

  // When opened from a notification, scroll to the end of the reply list so new replies are visible
  useEffect(() => {
    if (!scrollToLatest || isLoading || replies.length === 0) return
    replyListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [scrollToLatest, isLoading, replies.length])
  const [informPromptOpen, setInformPromptOpen] = useState(false)

  const canWrite = !!userId && profile?.tier !== 'inform' && !profile?.is_suspended

  const handleReply = (replyId: string, authorName: string) => {
    if (!canWrite && profile?.tier === 'inform') {
      setInformPromptOpen(true)
      return
    }
    setActiveReplyTarget({ replyId, authorName })
    setReplyComposerOpen(true)
  }

  const handleReplyToPost = () => {
    if (profile?.tier === 'inform') {
      setInformPromptOpen(true)
      return
    }
    setActiveReplyTarget(null)
    setReplyComposerOpen(true)
  }

  // Build nested reply tree
  const rootReplies = replies.filter((r) => !r.parent_reply_id)
  const childMap = new Map<string, ReplyWithAuthor[]>()
  replies.forEach((r) => {
    if (r.parent_reply_id) {
      const children = childMap.get(r.parent_reply_id) ?? []
      children.push(r)
      childMap.set(r.parent_reply_id, children)
    }
  })

  const closeComposer = () => {
    setReplyComposerOpen(false)
    setActiveReplyTarget(null)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
          <button
            onClick={onBack}
            aria-label="Back to feed"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Thread</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Loading thread...
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header — back button merged with the post author's identity, like a post-detail page */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0 sticky top-0 z-10">
        <button
          onClick={onBack}
          aria-label="Back to feed"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {post ? (
          <button
            type="button"
            onClick={() => navigate('/profile/' + post.user_id)}
            className="flex items-center gap-2.5 min-w-0 text-left"
            aria-label={`View ${post.author.display_name}'s profile`}
          >
            {post.author.avatar_url ? (
              <img
                src={post.author.avatar_url}
                alt={post.author.display_name}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  {post.author.display_name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="flex items-baseline gap-1 min-w-0">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{post.author.display_name}</span>
              {post.author.tier === 'empowered' && <EmpoweredBadge />}
              <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                {post.edit_history.length > 0 && ' · edited'}
              </span>
            </span>
          </button>
        ) : (
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Thread</h2>
        )}
      </div>

      <div className="flex-1 px-4 pb-8">
        {/* 1. The post */}
        {post && (
          <div className="py-4">
            {/* Post title */}
            {post.title && (
              <p className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-100">{post.title}</p>
            )}

            {/* Post body */}
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{post.body}</p>

            {/* Action row: comment count + share */}
            <div className="mt-3 flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </span>
            </div>
          </div>
        )}

        {/* 2. Join the conversation — hidden when browsing a sibling slice
            read-only. */}
        {isViewOnly ? (
          <div className="py-3 flex items-start gap-2.5 rounded-lg bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="leading-snug">
              You're viewing this thread read-only.
              {typeof ownSliceIndex === 'number' && ` Replying is limited to your assigned community, Slice ${ownSliceIndex}.`}
            </p>
          </div>
        ) : (
          (!userId || !profile?.is_suspended) && (
            <div className="py-3">
              {(!replyComposerOpen || activeReplyTarget !== null) && (
                <button
                  onClick={handleReplyToPost}
                  className="w-full text-left px-3 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 text-sm text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                >
                  Join the conversation
                </button>
              )}
              {canWrite && replyComposerOpen && activeReplyTarget === null && (
                <ReplyComposer
                  postId={postId}
                  userId={userId!}
                  onClose={closeComposer}
                />
              )}
            </div>
          )
        )}

        {/* 3. All other comments */}
        <div ref={replyListRef} className="divide-y divide-gray-100 dark:divide-gray-700">
          {rootReplies.map((rootReply) => {
            const children = childMap.get(rootReply.id) ?? []
            const isTargeted = activeReplyTarget?.replyId === rootReply.id

            return (
              <div key={rootReply.id}>
                <ReplyCard
                  depth={0}
                  reply={rootReply}
                  canWrite={canWrite && !isViewOnly}
                  currentUserId={userId ?? undefined}
                  onReply={isViewOnly ? undefined : handleReply}
                />

                {/* Inline composer for this reply */}
                {isTargeted && replyComposerOpen && userId && (
                  <ReplyComposer
                    postId={postId}
                    userId={userId}
                    parentReplyId={rootReply.id}
                    replyingToName={activeReplyTarget.authorName}
                    onClose={closeComposer}
                  />
                )}

                {/* Depth-1 children */}
                {children.map((child) => (
                  <ReplyCard
                    key={child.id}
                    depth={1}
                    reply={child}
                    canWrite={false}
                    currentUserId={userId ?? undefined}
                  />
                ))}
              </div>
            )
          })}
        </div>

        {/* Load more */}
        {hasMoreReplies && (
          <div className="pt-4 flex justify-center">
            <button
              onClick={() => fetchMoreReplies()}
              className="text-sm text-brand hover:underline"
            >
              Load more replies
            </button>
          </div>
        )}
      </div>

      <InformUpgradePrompt
        isOpen={informPromptOpen}
        onClose={() => setInformPromptOpen(false)}
      />
    </div>
  )
}
