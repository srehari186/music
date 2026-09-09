import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { ButtonSpinner, LoadingScreen } from '../../components/Loading'
import { supabase } from '../../lib/supabase'
import { formatRelativeTime, friendlyError } from '../../utils'

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '')
      setAvatarUrl(profile.avatar_url ?? '')
      setReady(true)
    }
  }, [profile])

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (displayName.trim().length < 2) {
      toast.error('Display name must be at least 2 characters')
      return
    }
    setBusy(true)
    try {
      // NOTE: role is intentionally NOT included — RLS prevents role changes.
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim(), avatar_url: avatarUrl.trim() || null } as never)
        .eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      toast.success('Profile updated')
    } catch (err) {
      toast.error(friendlyError(err, 'Could not update profile'))
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <LoadingScreen label="Loading profile…" />

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-white/55">Manage how you appear on Waveora.</p>
      </div>

      <div className="glass flex items-center gap-4 rounded-3xl p-6">
        {avatarUrl ? (
          <img src={avatarUrl} alt="Profile avatar" className="h-16 w-16 rounded-2xl object-cover" />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-aqua font-display text-2xl font-extrabold">
            {(displayName || profile?.email || 'W').slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-bold">{displayName || 'Music lover'}</p>
          <p className="truncate text-sm text-white/55">{profile?.email}</p>
          <p className="mt-1 text-xs text-white/40">
            Member since {formatRelativeTime(profile?.created_at)} • Role: <span className="font-semibold text-aqua">{profile?.role}</span>
          </p>
        </div>
      </div>

      <form onSubmit={onSave} className="glass space-y-4 rounded-3xl p-6">
        <div>
          <label htmlFor="dn" className="mb-1.5 block text-sm font-medium text-white/80">Display name</label>
          <input
            id="dn"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl border border-line bg-abyss px-4 py-3 text-sm outline-none focus:border-primary/60"
            required
          />
        </div>
        <div>
          <label htmlFor="av" className="mb-1.5 block text-sm font-medium text-white/80">Profile image URL</label>
          <input
            id="av"
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
            className="w-full rounded-xl border border-line bg-abyss px-4 py-3 text-sm outline-none placeholder:text-white/30 focus:border-primary/60"
          />
        </div>
        <div>
          <label htmlFor="em" className="mb-1.5 block text-sm font-medium text-white/80">Email</label>
          <input id="em" value={profile?.email ?? ''} disabled className="w-full cursor-not-allowed rounded-xl border border-line bg-white/5 px-4 py-3 text-sm text-white/50" />
          <p className="mt-1 text-xs text-white/40">Email is managed by authentication and cannot be changed here.</p>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-deep px-5 py-3 text-sm font-bold shadow-glow hover:brightness-110 disabled:opacity-60 focus-ring"
        >
          {busy && <ButtonSpinner />} Save changes
        </button>
      </form>
    </div>
  )
}
