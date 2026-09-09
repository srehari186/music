import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { AudioLines, LayoutDashboard, LogOut, Music2, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { signOut } from '../../services/authService'
import { friendlyError } from '../../utils'

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition focus-ring ${
    isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
  }`

export function AdminLayout() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const onLogout = async () => {
    try {
      await signOut()
      toast.success('Logged out')
      navigate('/admin/login')
    } catch (e) {
      toast.error(friendlyError(e, 'Logout failed'))
    }
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-abyss/70 p-4 md:flex" aria-label="Admin navigation">
        <div className="flex items-center gap-2.5 px-1 py-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-aqua">
            <AudioLines className="h-5 w-5 text-white" />
          </span>
          <div>
            <p className="font-display font-extrabold leading-none">Waveora</p>
            <p className="text-[11px] uppercase tracking-[0.2em] text-aqua">Admin console</p>
          </div>
        </div>
        <nav className="mt-4 flex flex-col gap-1">
          <NavLink to="/admin" end className={linkCls}>
            <LayoutDashboard className="h-5 w-5" /> Dashboard
          </NavLink>
          <NavLink to="/admin/songs" className={linkCls}>
            <Music2 className="h-5 w-5" /> Songs
          </NavLink>
          <NavLink to="/admin/users" className={linkCls}>
            <Users className="h-5 w-5" /> Users
          </NavLink>
          <NavLink to="/home" className={linkCls}>
            ← Back to app
          </NavLink>
        </nav>
        <div className="mt-auto rounded-2xl border border-line bg-panel/70 p-3 text-xs">
          <p className="truncate font-semibold text-white">{profile?.display_name ?? 'Admin'}</p>
          <p className="truncate text-white/55">{profile?.email}</p>
          <button onClick={onLogout} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/5 py-2 font-semibold text-white/70 hover:bg-rose/20 hover:text-white focus-ring">
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        </div>
      </aside>
      <div className="flex-1">
        <header className="sticky top-0 z-30 border-b border-line bg-void/85 backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 text-sm">
            <NavLink to="/admin" end className="rounded-lg bg-white/5 px-3 py-1.5 font-semibold">Dashboard</NavLink>
            <NavLink to="/admin/songs" className="rounded-lg bg-white/5 px-3 py-1.5 font-semibold">Songs</NavLink>
            <NavLink to="/admin/users" className="rounded-lg bg-white/5 px-3 py-1.5 font-semibold">Users</NavLink>
            <NavLink to="/home" className="rounded-lg bg-white/5 px-3 py-1.5 font-semibold">← App</NavLink>
            <button onClick={onLogout} className="ml-auto rounded-lg bg-white/5 px-3 py-1.5 font-semibold">Logout</button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
