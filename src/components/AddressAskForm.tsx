import { useState, type FormEvent } from 'react'
import { resolveAddress, type ResolvedGeography } from '../lib/censusGeocoder'

interface AddressAskFormProps {
  onResolve: (geo: ResolvedGeography) => void
}

export function AddressAskForm({ onResolve }: AddressAskFormProps) {
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!address.trim()) return
    setStatus('loading')
    const geo = await resolveAddress(address)
    if (geo && (geo.stateGeoid || geo.countyGeoid || geo.placeGeoid || geo.federalGeoid)) {
      onResolve(geo)
      setStatus('idle')
    } else {
      setStatus('error')
    }
  }

  return (
    <div className="w-full max-w-sm">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Where do you live?
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Enter your address to see your neighborhood, county, state, and federal discussions.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value)
            setStatus('idle')
          }}
          placeholder="Street address, city, state, ZIP"
          aria-label="Address"
          className="h-11 px-3.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
        />
        {status === 'error' && (
          <p className="text-xs text-red-500">Couldn't find that address — double-check and try again.</p>
        )}
        <button
          type="submit"
          disabled={status === 'loading'}
          className="h-11 rounded-full bg-brand-btn text-white text-sm font-semibold hover:bg-brand-hover transition-colors disabled:opacity-50"
        >
          {status === 'loading' ? 'Looking up…' : 'Show my feed'}
        </button>
      </form>
    </div>
  )
}
