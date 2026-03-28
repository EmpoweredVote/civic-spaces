interface SliceFeedPanelProps {
  sliceId: string
}

export default function SliceFeedPanel({ sliceId: _sliceId }: SliceFeedPanelProps) {
  return (
    <div className="flex flex-1 items-center justify-center text-gray-400 py-16">
      Feed loading...
    </div>
  )
}
