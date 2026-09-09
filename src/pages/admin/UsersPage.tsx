import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import type { Profile } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { LoadingScreen } from '../../components/Loading'
import { formatRelativeTime, friendlyError } from '../../utils'

export function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, display_name, avatar_url, role, created_at, updated_at')
          .order('created_at', { ascending: false })
          .limit(500)
        if (error) throw error
        if (!cancelled) setUsers((data ?? []) as Profile[])
      } catch (e) {
        toast.error(friendlyError(e, 'Could not load users'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <LoadingScreen label="Loading users…" />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-white/55">{users.length} registered accounts. Passwords are never exposed.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-panel/70">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-white/40">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-line/60">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" loading="lazy" />
                      ) : (
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-aqua text-xs font-bold">
                          {(u.display_name ?? u.email ?? '?').slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="font-medium">{u.display_name ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-white/60">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${u.role === 'admin' ? 'bg-primary/20 text-primary-soft' : 'bg-white/5 text-white/60'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-white/50">{formatRelativeTime(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && <p className="p-8 text-center text-sm text-white/50">No users yet.</p>}
      </div>
      <p className="text-xs text-white/40">
        Role changes must be done by an existing admin via Supabase SQL/dashboard — never from the user frontend.
      </p>
    </div>
  )
}
