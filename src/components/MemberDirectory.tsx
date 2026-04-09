import { useState } from 'react'
import { useLocation } from 'wouter'
import { useMemberDirectory } from '../hooks/useMemberDirectory'
import { useMemberSearch } from '../hooks/useMemberSearch'
import EmpoweredBadge from './EmpoweredBadge'
import type { MemberProfile } from '../hooks/useMemberDirectory'

interface MemberDirectoryProps {
  sliceId: string | null
  onClose: () => void
}

function MemberRow({
  member,
  onTap,
}: {
  member: MemberProfile
  onTap: (userId: string) => void
}) {
  return (
    <button
      onClick={() => onTap(member.user_id)}
      className="w-full flex items-center gap-3 py-3 text-left"
    >
      {member.avatar_url ? (
        <img
          src={member.avatar_url}
          alt={member.display_name}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-medium text-gray-600">
            {member.display_name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-sm font-medium text-gray-900 truncate">{member.display_name}</span>
        {member.tier === 'empowered' && <EmpoweredBadge />}
      </div>
    </button>
  )
}

function DirectoryList({
  sliceId,
  onTap,
}: {
  sliceId: string | null
  onTap: (userId: string) => void
}) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMemberDirectory(sliceId)
  const members = data?.pages.flatMap((page) => page) ?? []

  if (isLoading) return <p className="text-sm text-gray-400 text-center py-6">Loading...</p>
  if (members.length === 0)
    return <p className="text-sm text-gray-400 text-center py-6">No members found.</p>

  return (
    <>
      <div className="divide-y divide-gray-100">
        {members.map((m) => (
          <MemberRow key={m.user_id} member={m} onTap={onTap} />
        ))}
      </div>
      {hasNextPage && (
        <div className="flex justify-center py-4">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="text-sm text-brand hover:underline disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </>
  )
}

function SearchResults({
  term,
  crossSlice,
  sliceId,
  onTap,
}: {
  term: string
  crossSlice: boolean
  sliceId: string | null
  onTap: (userId: string) => void
}) {
  const { data, isLoading } = useMemberSearch(term, crossSlice, sliceId)

  if (isLoading) return <p className="text-sm text-gray-400 text-center py-6">Searching...</p>
  if (!data || data.length === 0)
    return <p className="text-sm text-gray-400 text-center py-6">No results for "{term}".</p>

  return (
    <div className="divide-y divide-gray-100">
      {data.map((m) => (
        <MemberRow key={m.user_id} member={m} onTap={onTap} />
      ))}
    </div>
  )
}

export default function MemberDirectory({ sliceId, onClose }: MemberDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [crossSlice, setCrossSlice] = useState(false)
  const [, navigate] = useLocation()

  const showSearch = searchTerm.length >= 2

  function handleMemberTap(userId: string) {
    navigate('/profile/' + userId)
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Member Directory</h2>
        <button
          onClick={onClose}
          aria-label="Close member directory"
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

      {/* Search controls */}
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0 space-y-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search members..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
        />
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={crossSlice}
            onChange={(e) => setCrossSlice(e.target.checked)}
            className="rounded border-gray-300 text-brand focus:ring-brand"
          />
          <span className="text-sm text-gray-600">Search beyond your slice</span>
        </label>
      </div>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto px-4">
        {showSearch ? (
          <SearchResults
            term={searchTerm}
            crossSlice={crossSlice}
            sliceId={sliceId}
            onTap={handleMemberTap}
          />
        ) : (
          <DirectoryList sliceId={sliceId} onTap={handleMemberTap} />
        )}
      </div>
    </div>
  )
}
