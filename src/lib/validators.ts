import { z } from 'zod'

// 🔴 The title cap is DEFINED in postTitle.ts, beside the elide() that meets it,
// and re-exported here so every existing `from '../lib/validators'` still works.
// It lives there because agendaTopics.ts and writingGuidance.ts both need it and
// neither can import this file: zod is a runtime dependency, and check:agenda-topics
// loads both of them with `node --experimental-strip-types`.
export { POST_TITLE_MAX } from './postTitle.ts'
import { POST_TITLE_MAX } from './postTitle.ts'

/** Field limits, shared by the schemas and the character counters that show them. */
export const POST_BODY_MAX = 10000
export const REPLY_BODY_MAX = 5000

// Messages a member reads, not zod's defaults ("String must contain at least 1 character(s)").
// `trim()` first, so a title of spaces is empty rather than valid.
export const createPostSchema = z.object({
  title: z.string().trim().min(1, 'Add a title.').max(POST_TITLE_MAX, `Keep the title to ${POST_TITLE_MAX} characters.`),
  body: z.string().trim().min(1, 'Write something before posting.').max(POST_BODY_MAX, `Keep your post to ${POST_BODY_MAX.toLocaleString()} characters.`),
})

export const editPostSchema = z.object({
  body: z.string().trim().min(1, 'Write something before saving.').max(POST_BODY_MAX, `Keep your post to ${POST_BODY_MAX.toLocaleString()} characters.`),
})

export const createReplySchema = z.object({
  body: z.string().trim().min(1, 'Write a reply before posting.').max(REPLY_BODY_MAX, `Keep your reply to ${REPLY_BODY_MAX.toLocaleString()} characters.`),
})

export type CreatePostInput = z.infer<typeof createPostSchema>
export type EditPostInput = z.infer<typeof editPostSchema>
export type CreateReplyInput = z.infer<typeof createReplySchema>
