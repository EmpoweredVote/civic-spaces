import { useEffect } from 'react'
import { Sheet } from 'react-modal-sheet'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createPostSchema, editPostSchema } from '../lib/validators'
import type { CreatePostInput, EditPostInput } from '../lib/validators'
import { useCreatePost } from '../hooks/useCreatePost'
import { useEditPost } from '../hooks/useEditPost'
import type { PostWithAuthor } from '../types/database'

/**
 * A new post that starts from somewhere else — Explore's topic drafts. Only ever a
 * prefill: the member still edits and presses Post themselves.
 */
export interface ComposeRequest {
  title: string
  body: string
  /** Shown above the form, e.g. "Posting to Bloomington" — names where this will land. */
  contextNote?: string
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
}

export default function PostComposer({
  isOpen,
  onClose,
  sliceId,
  userId,
  editPost,
  request,
}: PostComposerProps) {
  const isEditMode = !!editPost

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

  // Reset forms when sheet opens/closes or editPost changes
  useEffect(() => {
    if (isOpen) {
      if (isEditMode) {
        editForm.reset({ body: editPost?.body ?? '' })
      } else {
        createForm.reset({ title: request?.title ?? '', body: request?.body ?? '' })
      }
    }
  }, [isOpen, isEditMode, editPost?.body, request]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mirror edits back to the draft they came from, so closing the sheet loses nothing.
  const onDraftChange = request?.onDraftChange
  useEffect(() => {
    if (!isOpen || isEditMode || !onDraftChange) return
    const sub = createForm.watch((values) => onDraftChange({ title: values.title ?? '', body: values.body ?? '' }))
    return () => sub.unsubscribe()
  }, [isOpen, isEditMode, onDraftChange]) // eslint-disable-line react-hooks/exhaustive-deps

  const serverError = isEditMode
    ? editMutation.error?.message
    : createMutation.error?.message

  const handleCreateSubmit = async (data: CreatePostInput) => {
    try {
      await createMutation.mutateAsync(data)
      request?.onPosted?.()
      createForm.reset()
      onClose()
    } catch {
      // error is surfaced via mutation.error
    }
  }

  const handleEditSubmit = async (data: EditPostInput) => {
    if (!editPost) return
    try {
      await editMutation.mutateAsync({ postId: editPost.id, body: data.body })
      editForm.reset()
      onClose()
    } catch {
      // error is surfaced via mutation.error
    }
  }

  return (
    <Sheet isOpen={isOpen} onClose={onClose} detent="content-height">
      {/* react-modal-sheet paints the container and the drag handle white from its own
          stylesheet, so the surface has to be set here as well as the text inside it. */}
      <Sheet.Container className="bg-white dark:!bg-gray-900">
        <Sheet.Header className="bg-white dark:!bg-gray-900" />
        <Sheet.Content>
          <div className="px-4 pb-8">
            {/* Title bar */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {isEditMode ? 'Edit Post' : 'New Post'}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1 rounded-full text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!isEditMode && request?.contextNote && (
              <p className="mb-3 rounded-md bg-brand-muted dark:bg-brand/15 px-3 py-2 text-sm text-brand dark:text-brand-light">
                {request.contextNote}
              </p>
            )}

            {/* Server error banner */}
            {serverError && (
              <div className="mb-4 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3">
                <p className="text-sm text-red-700 dark:text-red-300">{serverError}</p>
              </div>
            )}

            {/* Create form */}
            {!isEditMode && (
              <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} noValidate>
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="What's happening in your community?"
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    {...createForm.register('title')}
                  />
                  {createForm.formState.errors.title && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {createForm.formState.errors.title.message}
                    </p>
                  )}
                </div>

                <div className="mb-4">
                  <textarea
                    rows={4}
                    placeholder="Share your thoughts..."
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                    {...createForm.register('body')}
                  />
                  {createForm.formState.errors.body && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {createForm.formState.errors.body.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={createForm.formState.isSubmitting}
                    className="flex-1 rounded-md bg-brand-btn px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {createForm.formState.isSubmitting ? 'Posting...' : 'Post'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Edit form */}
            {isEditMode && (
              <form onSubmit={editForm.handleSubmit(handleEditSubmit)} noValidate>
                <div className="mb-4">
                  <textarea
                    rows={4}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                    {...editForm.register('body')}
                  />
                  {editForm.formState.errors.body && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {editForm.formState.errors.body.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={editForm.formState.isSubmitting}
                    className="flex-1 rounded-md bg-brand-btn px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {editForm.formState.isSubmitting ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  )
}
