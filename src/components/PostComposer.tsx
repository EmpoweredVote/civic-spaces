import { useEffect } from 'react'
import { Sheet } from 'react-modal-sheet'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createPostSchema, editPostSchema } from '../lib/validators'
import type { CreatePostInput, EditPostInput } from '../lib/validators'
import { useCreatePost } from '../hooks/useCreatePost'
import { useEditPost } from '../hooks/useEditPost'
import type { PostWithAuthor } from '../types/database'

interface PostComposerProps {
  isOpen: boolean
  onClose: () => void
  sliceId: string
  userId: string
  editPost?: PostWithAuthor
}

export default function PostComposer({
  isOpen,
  onClose,
  sliceId,
  userId,
  editPost,
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
        createForm.reset({ title: '', body: '' })
      }
    }
  }, [isOpen, isEditMode, editPost?.body]) // eslint-disable-line react-hooks/exhaustive-deps

  const serverError = isEditMode
    ? editMutation.error?.message
    : createMutation.error?.message

  const handleCreateSubmit = async (data: CreatePostInput) => {
    try {
      await createMutation.mutateAsync(data)
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
      <Sheet.Container>
        <Sheet.Header />
        <Sheet.Content>
          <div className="px-4 pb-8">
            {/* Title bar */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditMode ? 'Edit Post' : 'New Post'}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
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

            {/* Server error banner */}
            {serverError && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700">{serverError}</p>
              </div>
            )}

            {/* Create form */}
            {!isEditMode && (
              <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} noValidate>
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="What's happening in your community?"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    {...createForm.register('title')}
                  />
                  {createForm.formState.errors.title && (
                    <p className="mt-1 text-xs text-red-600">
                      {createForm.formState.errors.title.message}
                    </p>
                  )}
                </div>

                <div className="mb-4">
                  <textarea
                    rows={4}
                    placeholder="Share your thoughts..."
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    {...createForm.register('body')}
                  />
                  {createForm.formState.errors.body && (
                    <p className="mt-1 text-xs text-red-600">
                      {createForm.formState.errors.body.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={createForm.formState.isSubmitting}
                    className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {createForm.formState.isSubmitting ? 'Posting...' : 'Post'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
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
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    {...editForm.register('body')}
                  />
                  {editForm.formState.errors.body && (
                    <p className="mt-1 text-xs text-red-600">
                      {editForm.formState.errors.body.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={editForm.formState.isSubmitting}
                    className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {editForm.formState.isSubmitting ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
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
