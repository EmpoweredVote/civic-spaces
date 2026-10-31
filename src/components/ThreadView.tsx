import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'wouter'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { useThread } from '../hooks/useThread'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import ReplyCard from './ReplyCard'
import ReplyComposer from './ReplyComposer'
import InformUpgradePrompt from './InformUpgradePrompt'
import EmpoweredBadge from './EmpoweredBadge'
import { ReadOnlyNotice } from './ReadOnlyNotice'
import { splitHeadline } from '../lib/postHeadline'
import type { ReplyWithAuthor } from '../types/database'
import type { NoWriteReason } from '../lib/writeAccess'

/**
 * The discussion's topic — the same headline the member clicked in the feed (a title, or
 * the author's first sentence), kept in view while they read replies or write one.
 * Sticks under AppShell's header and tab bar; --cs-sticky-offset is their combined height.
 */
function TopicHeader({ headline, placeName, onBack, stuck }: { headline: string | null; placeName?: string | null; onBack: () => void; stuck: boolean }) {
  return (
    <div
      className={`sticky top-[var(--cs-sticky-offset,8rem)] z-20 flex items-start gap-3 px-4 py-3 rounded-t-2xl border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 ${
        stuck ? 'shadow-sm' : ''
      }`}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to conversations"
        title="Back to conversations"
        className="mt-0.5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        {/* Where this conversation lives. A post carries no topic (no topic column),
            so the place is the context there is to keep in view. */}
        {placeName && (
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-coral-text dark:text-brand-coral">
            Conversation in {placeName}
          </p>
        )}
        <h1
          className={`mt-0.5 text-lg md:text-xl font-bold leading-snug text-gray-900 dark:text-gray-50 [overflow-wrap:anywhere] ${
            stuck ? 'line-clamp-2' : ''
          }`}
          title={stuck && headline ? headline : undefined}
        >
          {headline ?? 'Loading discussion…'}
        </h1>
      </div>
    </div>
  )
}

interface ThreadViewProps {
  postId: string
  onBack: () => void
  sliceId: string
  scrollToLatest?: boolean
  /** True when the viewer may not write in the slice this thread belongs to, for any reason. */
  isViewOnly?: boolean
  /** WHY not, for the notice's wording. Computed once in AppShell, never here. */
  noWriteReason?: NoWriteReason | null
  /** The user's own slice number for this location — used in the view-only explanation. */
  ownSliceIndex?: number
  /** The place this conversation belongs to, named. Null while it resolves. */
  placeName?: string | null
  /** The real sign-in, for "Sign in to reply". */
  loginUrl?: string
}


interface ReplyTarget {
  replyId: string
  authorName: string
}

export default function ThreadView({ postId, onBack, scrollToLatest, isViewOnly = false, noWriteReason = null, ownSliceIndex, placeName = null, loginUrl }: ThreadViewProps) {
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

  // True once the topic header has stuck under the app's bars — the sentinel just above
  // it has scrolled past that offset. Re-observed when the post arrives (the sentinel is
  // not rendered while loading).
  const stuckSentinelRef = useRef<HTMLDivElement>(null)
  const [isStuck, setIsStuck] = useState(false)

  // 🔴 rootMargin takes px and % only — a rem value is a SyntaxError in the observer
  // constructor, so the fallback and the guard below are both px. AppShell writes the
  // variable in px; this only has to survive it being briefly unset.
  const [stickyOffset, setStickyOffset] = useState('128px')
  useEffect(() => {
    const read = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--cs-sticky-offset').trim()
      setStickyOffset(v.endsWith('px') ? v : '128px')
    }
    read()
    // Both the header and the tab bar change height at md, so the threshold is re-read
    // rather than captured once — a resize across the breakpoint left it stale.
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])

  useEffect(() => {
    const el = stuckSentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry!.isIntersecting && entry!.boundingClientRect.top < window.innerHeight / 2),
      { rootMargin: `-${stickyOffset} 0px 0px 0px` },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [isLoading, stickyOffset])

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

  /**
   * Copies the thread's own address rather than whatever is in the address bar.
   * They are the same while a thread is open, but building it from postId keeps
   * this correct if a thread is ever opened without pushing a URL.
   */
  const handleShare = async () => {
    const url = `${window.location.origin}/post/${postId}`
    try {
      // Undefined outside a secure context, so this needs the guard as much as
      // it needs the catch.
      if (!navigator.clipboard) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy the link')
    }
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
        <TopicHeader headline={null} placeName={placeName} onBack={onBack} stuck={false} />
        <div className="flex-1 flex items-center justify-center py-10 text-sm text-gray-500 dark:text-gray-400">
          Loading discussion…
        </div>
      </div>
    )
  }

  // Only the headline: the topic header is a heading, and the post itself is rendered
  // in full below. Taking splitHeadline's excerpt here was lossy — an untitled post
  // whose first sentence has no break inside MAX_HEADLINE comes back as all headline
  // and no excerpt, so the whole post lived in the <h1> and line-clamp-2 cut it to two
  // lines the moment the header stuck. For an untitled post the opening sentence now
  // appears twice, as a page title does above its own article.
  const headline = post ? splitHeadline(post.title, post.body).headline : null
  const bodyText = post?.body.trim() ?? ''

  return (
    <div className="flex flex-col h-full">
      {/* Sentinel for the header below: once it scrolls under the app's sticky bars the
          header is stuck, and a long title clamps so it cannot cover the replies. */}
      <div ref={stuckSentinelRef} aria-hidden="true" />
      <TopicHeader headline={headline} placeName={placeName} onBack={onBack} stuck={isStuck} />

      <div className="flex-1 px-4 pb-8">
        {/* 1. The post — author, then the rest of what they wrote */}
        {post && (
          <div className="py-4">
            <button
              type="button"
              onClick={() => navigate('/profile/' + post.user_id)}
              className="flex items-center gap-2.5 min-w-0 max-w-full text-left rounded-full hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              aria-label={`View ${post.author.display_name}'s profile`}
            >
              {post.author.avatar_url ? (
                <img
                  src={post.author.avatar_url}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <span className="w-8 h-8 rounded-full bg-brand-muted dark:bg-brand/20 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-brand dark:text-brand-light" aria-hidden="true">
                  {post.author.display_name.charAt(0).toUpperCase()}
                </span>
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

            {/* The post as written, in full — the topic above is a heading, not the
                only copy of it. See the note on `headline`. */}
            {bodyText && (
              <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{bodyText}</p>
            )}

        {/* Action row: comment count + share */}
            <div className="mt-3 flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </span>
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v6a2 2 0 002 2h12a2 2 0 002-2v-6M16 6l-4-4-4 4M12 2v13" />
                </svg>
                Share
              </button>
            </div>
          </div>
        )}

        {/* 2. Join the conversation — hidden whenever the viewer may not write
            here, whatever the reason. 🔴 Gated on isViewOnly rather than on the
            reason: the composer must not come back because a reason failed to
            arrive. CLAUDE.md records that this repo shipped the feed half of
            this gate without the thread half once already. */}
        {isViewOnly ? (
          <div className="py-3">
            {/* A signed-out visitor gets the real sign-in here. The thread's /post/:id
                URL is already stashed for after it (AppShell's PENDING_POST_KEY), so they
                come back to this conversation. */}
            <ReadOnlyNotice reason={noWriteReason} surface="thread" ownSliceIndex={ownSliceIndex} loginUrl={loginUrl} />
          </div>
        ) : (
          (!userId || !profile?.is_suspended) && post && (
            <div className="py-3">
              {(!replyComposerOpen || activeReplyTarget !== null) && (
                <button
                  type="button"
                  onClick={handleReplyToPost}
                  className="w-full flex items-center gap-2 text-left px-4 py-2.5 rounded-full border border-gray-300 dark:border-white/15 text-sm font-medium text-gray-600 dark:text-gray-400 hover:border-brand dark:hover:border-brand-light hover:text-gray-900 dark:hover:text-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  Write a reply
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

        {/* The post could not be loaded — deleted, not readable from here, or a network
            failure. One message for all of them, like locatePost's `unavailable`. */}
        {!post && (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">This conversation isn’t available.</p>
            <button type="button" onClick={onBack} className="mt-2 text-sm font-semibold text-brand dark:text-brand-light hover:underline">
              Back to conversations
            </button>
          </div>
        )}

        {post && replies.length === 0 && !replyComposerOpen && (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            No replies yet.{!isViewOnly && canWrite ? ' Be the first to share a thought.' : ''}
          </p>
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
