import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
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
  header?: ReactNode
}

interface ReplyTarget {
  replyId: string
  authorName: string
}

export default function ThreadView({ postId, onBack, scrollToLatest, header }: ThreadViewProps) {
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
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
          <button
            onClick={onBack}
            className="text-brand hover:text-brand-btn text-sm font-medium"
            aria-label="Back to feed"
          >
            ← Back
          </button>
          <h2 className="text-sm font-semibold text-gray-900">Thread</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Loading thread...
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {header}
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="text-brand hover:text-brand-btn text-sm font-medium"
          aria-label="Back to feed"
        >
          ← Back
        </button>
        <h2 className="text-sm font-semibold text-gray-900">Thread</h2>
      </div>

      <div className="flex-1 px-4 pb-8">
        {/* Original post */}
        {post && (
          <div className="py-4 border-b border-gray-200">
            {/* Author row */}
            <button
              type="button"
              onClick={() => navigate('/profile/' + post.user_id)}
              className="flex items-center gap-3 w-full text-left"
              aria-label={`View ${post.author.display_name}'s profile`}
            >
              {post.author.avatar_url ? (
                <img
                  src={post.author.avatar_url}
                  alt={post.author.display_name}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-gray-600">
                    {post.author.display_name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-sm font-semibold text-gray-900">{post.author.display_name}</p>
                  {post.author.tier === 'empowered' && <EmpoweredBadge />}
                </div>
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  {post.edit_history.length > 0 && (
                    <span className="text-gray-400"> · edited</span>
                  )}
                </p>
              </div>
            </button>

            {/* Post title */}
            {post.title && (
              <p className="mt-3 text-base font-semibold text-gray-900">{post.title}</p>
            )}

            {/* Post body */}
            <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{post.body}</p>

            {/* Reply count separator */}
            <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </div>
          </div>
        )}

        {/* Reply to post action */}
        {userId && (
          <div className="py-3 border-b border-gray-100">
            {canWrite ? (
              <>
                {!replyComposerOpen || activeReplyTarget !== null ? (
                  <button
                    onClick={handleReplyToPost}
                    className="text-sm text-brand hover:underline"
                  >
                    Reply to post
                  </button>
                ) : null}
                {replyComposerOpen && activeReplyTarget === null && (
                  <ReplyComposer
                    postId={postId}
                    userId={userId}
                    onClose={closeComposer}
                  />
                )}
              </>
            ) : profile?.tier === 'inform' ? (
              <button
                onClick={handleReplyToPost}
                className="text-sm text-brand hover:underline"
              >
                Reply
              </button>
            ) : null}
          </div>
        )}

        {/* Reply tree */}
        <div ref={replyListRef} className="divide-y divide-gray-100">
          {rootReplies.map((rootReply) => {
            const children = childMap.get(rootReply.id) ?? []
            const isTargeted = activeReplyTarget?.replyId === rootReply.id

            return (
              <div key={rootReply.id}>
                <ReplyCard
                  depth={0}
                  reply={rootReply}
                  canWrite={canWrite}
                  currentUserId={userId ?? undefined}
                  onReply={handleReply}
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
