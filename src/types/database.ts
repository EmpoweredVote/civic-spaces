export type SliceType = 'federal' | 'state' | 'local' | 'neighborhood' | 'unified'

export interface Slice {
  id: string
  slice_type: SliceType
  geoid: string
  sibling_index: number
  current_member_count: number
  created_at: string
}

export interface SliceMember {
  id: string
  user_id: string
  slice_id: string
  joined_at: string
}

export interface ConnectedProfile {
  user_id: string
  display_name: string
  avatar_url: string | null
  tier: 'connected' | 'inform'
  account_standing: 'active' | 'suspended'
  is_suspended: boolean
  created_at: string
  updated_at: string
}

export interface EditHistoryEntry {
  body: string
  edited_at: string
}

export interface Post {
  id: string
  slice_id: string
  user_id: string
  title: string | null
  body: string
  reply_count: number
  edit_history: EditHistoryEntry[]
  created_at: string
  updated_at: string
  is_deleted: boolean
}

export interface Reply {
  id: string
  post_id: string
  parent_reply_id: string | null
  user_id: string
  body: string
  created_at: string
  updated_at: string
  is_deleted: boolean
}

export type PostWithAuthor = Post & {
  author: Pick<ConnectedProfile, 'display_name' | 'avatar_url'>
}

export type ReplyWithAuthor = Reply & {
  author: Pick<ConnectedProfile, 'display_name' | 'avatar_url'>
}
