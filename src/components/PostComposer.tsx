import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { createPostSchema, editPostSchema, POST_BODY_MAX, POST_TITLE_MAX } from '../lib/validators'
import type { CreatePostInput, EditPostInput } from '../lib/validators'
import { useCreatePost } from '../hooks/useCreatePost'
import { useEditPost } from '../hooks/useEditPost'
import { QuestionPicker } from './QuestionPicker'
import { FOCUS, PrimaryButton, TEXT_FIELD, TEXT_FIELD_INVALID } from './explore/exploreUi'
import { questionsFor } from '../lib/writingGuidance'
import { focusAtEnd } from '../lib/focusAtEnd'
import { writeErrorMessage } from '../lib/writeErrors'
import type { PostWithAuthor } from '../types/database'
import type { ExploreTopic } from '../types/explore'

/**
 * A new post that starts from somewhere else — Explore's topic drafts. Only ever a
 * prefill: the member still edits and presses Post themselves.
 */
export interface ComposeRequest {
  title: string
  body: string
  /** Shown above the form, e.g. "Posting to Bloomington" — names where this will land. */
  contextNote?: string
  /** The topic this came from, preselected in the topic picker. */
  topic?: ExploreTopic
  /** Called once the post is created, so the source can drop its draft. */
  onPosted?: () => void
  /** Called with every edit, so the source's draft keeps up with the composer. */
  onDraftChange?: (values: { title: string; body: string }) => void
}

interface PostComposerProps {
  isOpen: boolean
  onClose: () => void
  sliceId: string
  userId: string
  editPost?: PostWithAuthor
  request?: ComposeRequest | null
  /** Where this posts, named, for the line above the form. Absent while it resolves. */
  placeName?: string | null
  /** The topics a conversation here can be about — the optional picker. */
  topicOptions?: ExploreTopic[]
  /** The post is saved: open it. Called only after the database confirms the insert. */
  onCreated?: (postId: string) => void
}

export default function PostComposer({
  isOpen,
  onClose,
  sliceId,
  userId,
  editPost,
  request,
  placeName,
  topicOptions = [],
  onCreated,
}: PostComposerProps) {
  const id = useId()
  const isEditMode = !!editPost
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen

  // The parent owns open/closed; the <dialog> follows it.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) dialog.showModal()
    else if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  const createMutation = useCreatePost(sliceId, userId)
  const editMutation = useEditPost()

  const createForm = useForm<CreatePostInput>({
    resolver: zodResolver(createPostSchema),
    defaultValues: { title: '', body: '' },
  })

  const editForm = useForm<EditPostInput>({
    resolver: zodResolver(editPostSchema),
    defaultValues: { body: editPost?.body ?? '' },
  })

  // Topics the picker offers: this level's, plus the one a request came with if it is
  // not among them (an agenda item opened from Explore).
  const topics = useMemo(() => {
    const t = request?.topic
    return t && !topicOptions.some((o) => o.id === t.id) ? [t, ...topicOptions] : topicOptions
  }, [request?.topic, topicOptions])
  const [topicId, setTopicId] = useState('')
  const topic = topics.find((t) => t.id === topicId) ?? null
  const questions = useMemo(() => (topic ? questionsFor(topic) : null), [topic])

  // On open: a request (from Explore) or an edit always loads fresh. A plain new post
  // keeps whatever was typed last time — closing the sheet by accident loses nothing;
  // the fields clear only after a post is saved.
  useEffect(() => {
    if (!isOpen) return
    if (isEditMode) {
      editForm.reset({ body: editPost?.body ?? '' })
    } else if (request) {
      createForm.reset({ title: request.title, body: request.body })
      setTopicId(request.topic?.id ?? '')
    }
    createMutation.reset()
    editMutation.reset()
  }, [isOpen, isEditMode, editPost?.body, request]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mirror edits back to the draft they came from, so closing the sheet loses nothing.
  const onDraftChange = request?.onDraftChange
  useEffect(() => {
    if (!isOpen || isEditMode || !onDraftChange) return
    const sub = createForm.watch((values) => onDraftChange({ title: values.title ?? '', body: values.body ?? '' }))
    return () => sub.unsubscribe()
  }, [isOpen, isEditMode, onDraftChange]) // eslint-disable-line react-hooks/exhaustive-deps

  const title = createForm.watch('title') ?? ''
  const body = createForm.watch('body') ?? ''
  const editBody = editForm.watch('body') ?? ''

  const chooseTopic = (next: string) => {
    setTopicId(next)
    const picked = topics.find((t) => t.id === next)
    // Fill an EMPTY title only. Never replace something the member typed.
    if (picked && !createForm.getValues('title').trim()) {
      createForm.setValue('title', picked.suggestedTitle, { shouldDirty: true, shouldValidate: !!createForm.formState.errors.title })
    }
  }

  const handleCreateSubmit = async (data: CreatePostInput) => {
    // The submit button is disabled while pending; this guards a double Enter too.
    if (createMutation.isPending) return
    try {
      const saved = await createMutation.mutateAsync(data)
      request?.onPosted?.()
      createForm.reset({ title: '', body: '' })
      setTopicId('')
      onClose()
      toast.success('Posted')
      onCreated?.(saved.id)
    } catch {
      // Shown below from mutation.error. The text stays in the form for another try.
    }
  }

  const handleEditSubmit = async (data: EditPostInput) => {
    if (!editPost || editMutation.isPending) return
    try {
      await editMutation.mutateAsync({ postId: editPost.id, body: data.body })
      editForm.reset()
      onClose()
      toast.success('Saved')
    } catch {
      // error is surfaced via mutation.error
    }
  }

  const failed = isEditMode ? editMutation.error : createMutation.error
  const pending = isEditMode ? editMutation.isPending : createMutation.isPending
  const titleError = createForm.formState.errors.title?.message
  const bodyError = createForm.formState.errors.body?.message
  const editError = editForm.formState.errors.body?.message
  const where = request?.contextNote ?? (placeName ? `Posting to ${placeName}. Nothing is published until you press Post.` : null)

  const { ref: bodyFieldRef, ...bodyField } = createForm.register('body')

  return (
    /* A centred modal, the same native <dialog> "What's new" opens: showModal() gives the
       backdrop, focus trapping, Escape, and focus back on the Post button when it closes. */
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-h`}
      // Escape and close() both land here. Only report it while the parent still thinks
      // the dialog is open, or a close the parent asked for would echo back to it.
      onClose={() => isOpenRef.current && onClose()}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-auto w-[min(40rem,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200/60 dark:border-white/[0.08] bg-white dark:bg-gray-900 p-0 shadow-2xl backdrop:bg-black/50"
    >
          <div className="px-5 pb-6 pt-5 sm:px-7 sm:pb-7 sm:pt-6">
            {/* Title bar */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 id={`${id}-h`} className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                {isEditMode ? 'Edit post' : 'New conversation'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 ${FOCUS}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!isEditMode && where && (
              <p className="mb-3 rounded-xl bg-brand-muted dark:bg-brand/15 px-3 py-2 text-sm text-brand dark:text-brand-light">
                {where}
              </p>
            )}

            {/* The request failed. Nothing was saved, and the text is still in the form. */}
            {failed && (
              <div role="alert" className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3">
                <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                  {isEditMode ? 'Your changes weren’t saved.' : 'Your post wasn’t published.'}
                </p>
                <p className="mt-0.5 text-sm text-red-700 dark:text-red-300">
                  {writeErrorMessage(failed)} Your text is still here — press {isEditMode ? 'Save' : 'Post'} to try again.
                </p>
              </div>
            )}

            {/* Create form */}
            {!isEditMode && (
              <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} noValidate className="flex flex-col gap-3">
                {topics.length > 0 && (
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Topic <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span>
                    </span>
                    <select
                      value={topicId}
                      onChange={(e) => chooseTopic(e.target.value)}
                      aria-describedby={`${id}-topic-hint`}
                      className={TEXT_FIELD}
                    >
                      <option value="">No particular topic</option>
                      {topics.map((t) => (
                        <option key={t.id} value={t.id}>{topics.filter((o) => o.category === t.category).length > 1 ? `${t.category} — ${t.title}` : t.category}</option>
                      ))}
                    </select>
                    {/* 🔴 Says what the picker does and does not do. A post has no topic
                        column, so the choice shapes the writing help and an empty title —
                        it is not stored with the post, and must not claim to be. */}
                    <span id={`${id}-topic-hint`} className="text-xs text-gray-500 dark:text-gray-400">
                      Shows questions about the topic to start from. Topics aren’t saved with posts yet.
                    </span>
                  </label>
                )}

                <Field id={`${id}-title`} label="Title" count={title.length} max={POST_TITLE_MAX} error={titleError}>
                  <input
                    id={`${id}-title`}
                    type="text"
                    placeholder="What's happening in your community?"
                    maxLength={POST_TITLE_MAX}
                    aria-invalid={!!titleError}
                    aria-describedby={titleError ? `${id}-title-err` : undefined}
                    className={`${TEXT_FIELD} ${titleError ? TEXT_FIELD_INVALID : ''}`}
                    {...createForm.register('title')}
                  />
                </Field>

                {/* Under the title, as asked: the topic's questions, one selectable. */}
                {questions && (
                  <QuestionPicker
                    key={topicId}
                    questions={questions}
                    value={body}
                    onChange={(next) => createForm.setValue('body', next.slice(0, POST_BODY_MAX), { shouldDirty: true, shouldValidate: !!bodyError })}
                    onPicked={() => focusAtEnd(bodyRef.current)}
                  />
                )}

                <Field id={`${id}-body`} label="Your thoughts" count={body.length} max={POST_BODY_MAX} error={bodyError}>
                  <textarea
                    id={`${id}-body`}
                    rows={5}
                    placeholder={topic?.question ?? 'Share your thoughts…'}
                    maxLength={POST_BODY_MAX}
                    aria-invalid={!!bodyError}
                    aria-describedby={bodyError ? `${id}-body-err` : undefined}
                    className={`${TEXT_FIELD} resize-y ${bodyError ? TEXT_FIELD_INVALID : ''}`}
                    ref={(el) => {
                      bodyFieldRef(el)
                      bodyRef.current = el
                    }}
                    {...bodyField}
                  />
                </Field>

                <div className="flex items-center gap-3 pt-1">
                  <PrimaryButton type="submit" size="card" disabled={pending}>
                    {pending ? 'Posting…' : 'Post'}
                  </PrimaryButton>
                  <button
                    type="button"
                    onClick={onClose}
                    className={`rounded text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:underline ${FOCUS}`}
                  >
                    Cancel
                  </button>
                  <span aria-live="polite" className="sr-only">{pending ? 'Posting' : ''}</span>
                </div>
              </form>
            )}

            {/* Edit form */}
            {isEditMode && (
              <form onSubmit={editForm.handleSubmit(handleEditSubmit)} noValidate className="flex flex-col gap-3">
                <Field id={`${id}-edit`} label="Your post" count={editBody.length} max={POST_BODY_MAX} error={editError}>
                  <textarea
                    id={`${id}-edit`}
                    rows={5}
                    maxLength={POST_BODY_MAX}
                    aria-invalid={!!editError}
                    aria-describedby={editError ? `${id}-edit-err` : undefined}
                    className={`${TEXT_FIELD} resize-y ${editError ? TEXT_FIELD_INVALID : ''}`}
                    {...editForm.register('body')}
                  />
                </Field>

                <div className="flex items-center gap-3 pt-1">
                  <PrimaryButton type="submit" size="card" disabled={pending}>
                    {pending ? 'Saving…' : 'Save'}
                  </PrimaryButton>
                  <button
                    type="button"
                    onClick={onClose}
                    className={`rounded text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:underline ${FOCUS}`}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
    </dialog>
  )
}

/** A labelled field with a character count and an error tied to it. */
function Field({
  id,
  label,
  count,
  max,
  error,
  children,
}: {
  id: string
  label: string
  count: number
  max: number
  error?: string
  children: ReactNode
}) {
  const near = count > max * 0.9
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</label>
        <span className={`text-xs tabular-nums ${near ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {count.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      {children}
      {error && (
        <p id={`${id}-err`} className="text-xs font-medium text-red-700 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
