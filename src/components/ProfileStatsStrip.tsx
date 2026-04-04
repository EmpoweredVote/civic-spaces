interface ProfileStatsStripProps {
  postCount: number
  replyCount: number
  friendCount: number
}

interface StatCellProps {
  value: number
  label: string
  muted?: boolean
}

function StatCell({ value, label, muted = false }: StatCellProps) {
  return (
    <div className="flex flex-col items-center px-2 py-3">
      <span className={`text-lg font-bold ${muted ? 'text-gray-400' : 'text-gray-900'}`}>
        {value}
      </span>
      <span className="text-xs text-gray-500 mt-0.5">{label}</span>
    </div>
  )
}

export default function ProfileStatsStrip({ postCount, replyCount, friendCount }: ProfileStatsStripProps) {
  return (
    <div className="grid grid-cols-3 divide-x divide-gray-200 border border-gray-200 rounded-lg overflow-hidden bg-white">
      <StatCell value={postCount} label="Posts" />
      <StatCell value={replyCount} label="Replies" />
      <StatCell value={friendCount} label="Friends" muted />
    </div>
  )
}
