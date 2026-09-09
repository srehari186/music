import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ListMusic, Music2, Play, Users } from 'lucide-react'
import type { Profile, Song } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { LoadingScreen } from '../../components/Loading'
import { formatCount, formatRelativeTime, friendlyError } from '../../utils'

export function AdminDashboardPage() {
  const [stats, setStats] = useState({ users: 0, songs: 0, playlists: 0, plays: 0 })
  const [top, setTop] = useState<Song[]>([])
  const [latest, setLatest] = useState<Song[]>([])
  const [recentUsers, setRecentUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const [u, s, pl, songs] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('songs').select('id', { count: 'exact', head: true }),
          supabase.from('playlists').select('id', { count: 'exact', head: true }),
          supabase.from('songs').select('*').order('play_count', { ascending: false }).limit(50)
        ])
        if (u.error) throw u.error
        if (s.error) throw s.error
        if (pl.error) throw pl.error
        if (songs.error) throw songs.error
        const list = (songs.data ?? []) as Song[]
        setStats({
          users: u.count ?? 0,
          songs: s.count ?? 0,
          playlists: pl.count ?? 0,
          plays: list.reduce((acc, x) => acc + (x.play_count ?? 0), 0)
        })
        setTop(list.slice(0, 5))
        const { data: newest } = await supabase.from('songs').select('*').order('created_at', { ascending: false }).limit(5)
        setLatest((newest ?? []) as Song[])
        const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(5)
        setRecentUsers((users ?? []) as Profile[])
      } catch (e) {
        toast.error(friendlyError(e, 'Could not load dashboard stats'))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <LoadingScreen label="Loading dashboard…" />

  const cards = [
    { label: 'Total users', value: formatCount(stats.users), icon: <Users className="h-5 w-5 text-aqua" />, grad: 'from-aqua/25 to-transparent' },
    { label: 'Total songs', value: formatCount(stats.songs), icon: <Music2 className="h-5 w-5 text-primary-soft" />, grad: 'from-primary/25 to-transparent' },
    { label: 'Total playlists', value: formatCount(stats.playlists), icon: <ListMusic className="h-5 w-5 text-ember" />, grad: 'from-ember/20 to-transparent' },
    { label: 'Total plays', value: formatCount(stats.plays), icon: <Play className="h-5 w-5 text-rose" />, grad: 'from-rose/20 to-transparent' }
  ]

  const maxPlays = Math.max(1, ...top.map((t) => t.play_count ?? 0))

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-white/55">Catalog health, listeners and recent activity.</p>
        </div>
        <Link to="/admin/songs/new" className="rounded-xl bg-gradient-to-r from-primary to-primary-deep px-5 py-2.5 text-sm font-bold shadow-glow hover:brightness-110 focus-ring">
          + Add song
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-2xl border border-line bg-gradient-to-br ${c.grad} bg-panel p-5`}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/8 border border-line bg-white/5">{c.icon}</span>
            <p className="mt-3 font-display text-3xl font-extrabold">{c.value}</p>
            <p className="text-xs uppercase tracking-wider text-white/50">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-panel/70 p-5" aria-label="Most played songs">
          <h2 className="font-display font-bold">Most played</h2>
          <div className="mt-4 space-y-3">
            {top.length === 0 && <p className="text-sm text-white/50">No songs yet.</p>}
            {top.map((s) => (
              <div key={s.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium">{s.title} <span className="text-white/45">— {s.artist}</span></span>
                  <span className="text-xs text-white/50">{formatCount(s.play_count)} plays</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/8 bg-white/5">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-aqua" style={{ width: `${((s.play_count ?? 0) / maxPlays) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-panel/70 p-5" aria-label="Recently added songs">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold">Recently added</h2>
            <Link to="/admin/songs" className="text-xs font-semibold text-aqua hover:text-aqua-soft">Manage →</Link>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {latest.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                <span className="truncate">{s.title} <span className="text-white/45">— {s.artist}</span></span>
                <span className="shrink-0 text-xs text-white/40">{formatRelativeTime(s.created_at)}</span>
              </li>
            ))}
            {latest.length === 0 && <p className="text-sm text-white/50">No songs yet.</p>}
          </ul>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-panel/70" aria-label="Recent users">
        <h2 className="p-5 pb-0 font-display font-bold">Recent users</h2>
        <div className="overflow-x-auto p-2">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-white/40">
                <th className="px-3 py-2">Display name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((u) => (
                <tr key={u.id} className="border-t border-line/60">
                  <td className="px-3 py-2 font-medium">{u.display_name ?? '—'}</td>
                  <td className="px-3 py-2 text-white/60">{u.email}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${u.role === 'admin' ? 'bg-primary/20 text-primary-soft' : 'bg-white/8 text-white/60 bg-white/5'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-white/50">{formatRelativeTime(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentUsers.length === 0 && <p className="p-5 text-sm text-white/50">No users yet.</p>}
        </div>
      </section>
    </div>
  )
}
