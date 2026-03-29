import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Notification } from '../types/database'

// ---- useNotifications ----

interface UseNotificationsResult {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
}

export function useNotifications(): UseNotificationsResult {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  // Subscribe to Realtime changes on civic_spaces.notifications for this recipient
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'civic_spaces',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, queryClient])

  const { data, isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('civic_notifications')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return (data ?? []) as Notification[]
    },
    enabled: !!userId,
    staleTime: 30_000,
  })

  const notifications = data ?? []
  const rawUnread = notifications.filter((n) => !n.is_read).length
  const unreadCount = Math.min(rawUnread, 99)

  return { notifications, unreadCount, isLoading }
}

// ---- useMarkNotificationRead ----

export function useMarkNotificationRead() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('civic_notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
    },
  })
}

// ---- useMarkAllNotificationsRead ----

export function useMarkAllNotificationsRead() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('civic_notifications')
        .update({ is_read: true })
        .eq('is_read', false)
        .eq('recipient_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
    },
  })
}
