import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateReply } from '../hooks/useCreateReply'

const replySchema = z.object({
  body: z.string().min(1).max(5000),
})

type ReplyFormData = z.infer<typeof replySchema>

interface ReplyComposerProps {
  postId: string
  userId: string
  parentReplyId?: string
  replyingToName?: string
  onClose: () => void
  onSuccess?: () => void
}

export default function ReplyComposer({
  postId,
  userId,
  parentReplyId,
  replyingToName,
  onClose,
  onSuccess,
}: ReplyComposerProps) {
  const createReply = useCreateReply(postId, userId)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = useForm<ReplyFormData>({
    resolver: zodResolver(replySchema),
    defaultValues: { body: '' },
  })

  const body = watch('body')

  const onSubmit = async (data: ReplyFormData) => {
    await createReply.mutateAsync({
      body: data.body,
      parentReplyId,
    })
    reset()
    onClose()
    onSuccess?.()
  }

  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      {replyingToName && (
        <p className="text-xs text-gray-500 mb-1">Replying to {replyingToName}</p>
      )}
      <form onSubmit={handleSubmit(onSubmit)}>
        <textarea
          {...register('body')}
          rows={2}
          placeholder="Write a reply..."
          className="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="flex items-center justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !body.trim()}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Reply
          </button>
        </div>
      </form>
    </div>
  )
}
