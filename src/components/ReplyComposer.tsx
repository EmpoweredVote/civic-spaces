import { useEffect, useId, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCreateReply } from '../hooks/useCreateReply'
import EmpoweredBadge from './EmpoweredBadge'
import { FOCUS, PrimaryButton, TEXT_FIELD, TEXT_FIELD_INVALID } from './explore/exploreUi'
import { createReplySchema, REPLY_BODY_MAX, type CreateReplyInput } from '../lib/validators'
import { writeErrorMessage } from '../lib/writeErrors'

interface ReplyComposerProps {
  postId: string
  userId: string
  parentReplyId?: string
  replyingToName?: string
  replyingToTier?: string
  onClose: () => void
  onSuccess?: () => void
}

/**
 * The unsent reply, kept on this device per (post, parent) so a failed request, a closed
 * composer or a reload does not lose it. Cleared only once the reply is saved. Every
 * access is wrapped: private windows throw, and the composer must still work then.
 */
function draftKey(postId: string, parentReplyId?: string) {
  return `cs_reply_draft:${postId}:${parentReplyId ?? 'post'}`
}
function readDraft(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}
function writeDraft(key: string, body: string) {
  try {
    if (body) localStorage.setItem(key, body)
    else localStorage.removeItem(key)
  } catch {
    // Storage blocked — the draft lives only as long as the page.
  }
}

export default function ReplyComposer({
  postId,
  userId,
  parentReplyId,
  replyingToName,
  replyingToTier,
  onClose,
  onSuccess,
}: ReplyComposerProps) {
  const id = useId()
  const key = draftKey(postId, parentReplyId)
  const createReply = useCreateReply(postId, userId)
  const fieldRef = useRef<HTMLTextAreaElement | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateReplyInput>({
    resolver: zodResolver(createReplySchema),
    defaultValues: { body: readDraft(key) },
  })

  const body = watch('body') ?? ''
  useEffect(() => writeDraft(key, body), [key, body])

  // Opening the composer is asking to write: put the caret in the field.
  useEffect(() => fieldRef.current?.focus(), [])

  const pending = createReply.isPending
  const error = errors.body?.message

  const onSubmit = async (data: CreateReplyInput) => {
    if (createReply.isPending) return
    try {
      // Resolves only after the reply list has been re-fetched with the saved reply in it.
      await createReply.mutateAsync({ body: data.body, parentReplyId })
      writeDraft(key, '')
      reset({ body: '' })
      onClose()
      onSuccess?.()
    } catch {
      // Shown below from createReply.error; the text stays for another try.
    }
  }

  const { ref: registerRef, ...field } = register('body')

  return (
    <div className="mt-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-800/60 p-3">
      {replyingToName && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1">
          Replying to {replyingToName}
          {replyingToTier === 'empowered' && <EmpoweredBadge />}
        </p>
      )}

      {createReply.error && (
        <div role="alert" className="mb-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3 py-2">
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">Your reply wasn’t posted.</p>
          <p className="text-sm text-red-700 dark:text-red-300">
            {writeErrorMessage(createReply.error)} Your reply is still here — press Try again.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <label htmlFor={`${id}-body`} className="sr-only">
          {replyingToName ? `Reply to ${replyingToName}` : 'Your reply'}
        </label>
        <textarea
          id={`${id}-body`}
          {...field}
          ref={(el) => {
            registerRef(el)
            fieldRef.current = el
          }}
          rows={3}
          maxLength={REPLY_BODY_MAX}
          placeholder="Share your thoughts…"
          aria-invalid={!!error}
          aria-describedby={`${id}-count${error ? ` ${id}-err` : ''}`}
          className={`${TEXT_FIELD} resize-y ${error ? TEXT_FIELD_INVALID : ''}`}
        />
        {error && <p id={`${id}-err`} className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">{error}</p>}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span id={`${id}-count`} className={`text-xs tabular-nums ${body.length > REPLY_BODY_MAX * 0.9 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {body.length.toLocaleString()} / {REPLY_BODY_MAX.toLocaleString()}
            <span className="sr-only"> characters</span>
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className={`rounded text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:underline disabled:opacity-50 ${FOCUS}`}
            >
              Cancel
            </button>
            <PrimaryButton type="submit" disabled={pending}>
              {pending ? 'Posting…' : createReply.error ? 'Try again' : 'Reply'}
            </PrimaryButton>
          </div>
        </div>
        <span aria-live="polite" className="sr-only">{pending ? 'Posting your reply' : ''}</span>
      </form>
    </div>
  )
}
