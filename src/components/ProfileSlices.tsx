import type { SliceType, SliceInfo } from '../types/database'

const DISPLAY_ORDER: SliceType[] = ['federal', 'state', 'local', 'neighborhood', 'unified', 'volunteer']

const LABEL_MAP: Record<SliceType, string> = {
  federal: 'Federal',
  state: 'State',
  local: 'Local',
  neighborhood: 'Neighborhood',
  unified: 'Unified',
  volunteer: 'Volunteer',
}

function SharedSliceChip() {
  return (
    <span className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" aria-hidden="true" />
      <span className="text-xs text-blue-500">you&apos;re here too</span>
    </span>
  )
}

interface ProfileSlicesProps {
  subjectSlices: Partial<Record<SliceType, SliceInfo>>
  viewerSlices: Partial<Record<SliceType, SliceInfo>>
  isSelf: boolean
}

export default function ProfileSlices({ subjectSlices, viewerSlices, isSelf }: ProfileSlicesProps) {
  const presentSlices = DISPLAY_ORDER.filter((type) => subjectSlices[type] != null)

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 mb-2">Slice Memberships</h2>
      {presentSlices.length === 0 ? (
        <p className="text-sm text-gray-400">No slice memberships</p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-100">
          {presentSlices.map((type) => {
            const isShared = !isSelf && subjectSlices[type] != null && viewerSlices[type] != null
            return (
              <div key={type} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-gray-800">{LABEL_MAP[type]}</span>
                {isShared && <SharedSliceChip />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
