export type SliceType = 'federal' | 'state' | 'county' | 'city' | 'unified' | 'volunteer'

export type TabKey = 'city' | 'county' | 'state' | 'federal' | 'unified' | 'volunteer'

export interface SliceInfo {
  id: string
  sliceType: SliceType
  geoid: string
  /**
   * 🔴 Null for a VISITED PLACE, which has no `slices` row to count. Phase 17
   * must not invent one: a sentinel slice carrying 0 would state "0 members in
   * this slice" about a real jurisdiction — a confident false fact, the exact
   * class of bug Phase 17 exists to delete.
   *
   * Widened rather than defaulted on purpose. The compiler is what finds every
   * surface that RENDERS the count, and it found two: `HeroBanner`'s fact chip
   * and `SliceTabBar`'s active-tab subtitle. The second is below `lg` only, so a
   * phone would have been the one place the false number showed.
   */
  memberCount: number | null
  siblingIndex: number
  photoUrl?: string | null
}

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
  tier: 'connected' | 'inform' | 'empowered'
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
  author: Pick<ConnectedProfile, 'display_name' | 'avatar_url' | 'tier'>
}

export type ReplyWithAuthor = Reply & {
  author: Pick<ConnectedProfile, 'display_name' | 'avatar_url' | 'tier'>
}

// ---- Phase 3: Social Graph types ----

export type FriendshipStatus = 'REQ_LOW' | 'REQ_HIGH' | 'FRIEND'

export interface Friendship {
  user_low: string
  user_high: string
  status: FriendshipStatus
  created_at: string
  updated_at: string
}

export interface Follow {
  follower_id: string
  target_id: string
  created_at: string
}

export type BoostedPost = Post & {
  boosted_at: string
}

export type BoostedPostWithAuthor = BoostedPost & {
  author: Pick<ConnectedProfile, 'display_name' | 'avatar_url' | 'tier'>
}

export type RelationshipState = 'none' | 'pending_sent' | 'pending_received' | 'friends'

// ---- Phase 4: Notifications types ----

export type NotificationEventType = 'reply' | 'friend_request' | 'friend_accepted' | 'warn'

// ---- Phase 5: Moderation & Safety types ----

export type FlagCategory = 'spam' | 'harassment' | 'misinformation' | 'other'
export type FlagStatus = 'pending' | 'resolved' | 'dismissed'

export interface Flag {
  id: string
  content_id: string
  content_type: 'post' | 'reply'
  reporter_id: string
  category: FlagCategory
  detail: string | null
  status: FlagStatus
  created_at: string
}

export interface Block {
  blocker_id: string
  blocked_id: string
  created_at: string
}

export interface ModQueueItem {
  content_id: string
  content_type: 'post' | 'reply'
  body: string
  title: string | null
  author_id: string
  post_created_at: string
  flag_count: number
  flag_categories: FlagCategory[]
  first_flagged_at: string
  priority: 'high' | 'normal'
}

export type ModAction = 'remove' | 'dismiss' | 'warn' | 'suspend'

export interface ActionLogEntry {
  id: string
  moderator_id: string
  action: ModAction
  target_type: 'post' | 'user'
  target_id: string
  flag_ids: string[]
  notes: string | null
  created_at: string
}

export interface Notification {
  id: string
  recipient_id: string
  event_type: NotificationEventType
  actor_id: string
  actor_ids: string[]
  reference_id: string
  reference_excerpt: string | null
  event_count: number
  is_read: boolean
  group_window: string
  created_at: string
  updated_at: string
}
