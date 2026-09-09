import { useState } from 'react'
import { Search, X } from 'lucide-react'

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search songs, artists, albums, genres…'
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border bg-panel/80 px-4 py-3 transition ${
        focused ? 'border-primary/60 shadow-glow' : 'border-line'
      }`}
    >
      <Search className="h-4 w-4 shrink-0 text-white/45" aria-hidden />
      <label htmlFor="wv-search" className="sr-only">
        Search music
      </label>
      <input
        id="wv-search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none placeholder:text-white/35"
        autoComplete="off"
      />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear search" className="rounded p-1 text-white/50 hover:text-white focus-ring">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
