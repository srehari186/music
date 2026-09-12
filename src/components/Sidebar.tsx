import { NavLink, useNavigate } from 'react-router-dom'
import { Heart, Home, Library, LogOut, Search, ShieldCheck, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { Logo } from './Logo'
import { useAuth } from '../contexts/AuthContext'
import { signOut } from '../services/authService'
import { friendlyError } from '../utils'

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition focus-ring ${
    isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'
  }`

export function Sidebar() {
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()

  const onLogout = async () => {
    try {
      await signOut()
      toast.success('Logged out')
      navigate('/login')
    } catch (e) {
      toast.error(friendlyError(e, 'Logout failed'))
    }
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-2 border-r border-line bg-abyss/60 p-4 lg:flex" aria-label="Primary">
      <div className="px-1 py-2">
        <Logo />
      </div>
      <nav className="mt-2 flex flex-col gap-1">
        <NavLink to="/home" className={linkCls} aria-label="Home">
          <Home className="h-5 w-5" /> Home
        </NavLink>
        <NavLink to="/search" className={linkCls} aria-label="Search">
          <Search className="h-5 w-5" /> Search
        </NavLink>
        <NavLink to="/library" className={linkCls} aria-label="Your library">
          <Library className="h-5 w-5" /> Your Library
        </NavLink>
        <NavLink to="/liked" className={linkCls} aria-label="Liked songs">
          <Heart className="h-5 w-5" /> Liked Songs
        </NavLink>
        <NavLink to="/playlists" className={linkCls} aria-label="Playlists">
          <Library className="h-5 w-5" /> Playlists
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin" className={linkCls} aria-label="Admin dashboard">
            <ShieldCheck className="h-5 w-5" /> Admin
          </NavLink>
        )}
      </nav>
      <div className="mt-auto rounded-2xl border border-line bg-panel/70 p-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-primary to-flame font-display font-bold">
            {(profile?.display_name ?? profile?.email ?? 'W').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{profile?.display_name ?? 'Music lover'}</p>
            <p className="truncate text-xs text-white/55">{profile?.email}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <NavLink
            to="/profile"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/10 px-2 py-2 text-xs font-semibold hover:bg-white/15 focus-ring"
          >
            <User className="h-3.5 w-3.5" /> Profile
          </NavLink>
          <button
            onClick={onLogout}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/5 px-2 py-2 text-xs font-semibold text-white/70 hover:bg-rose/20 hover:text-white focus-ring"
            aria-label="Logout"
          >
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        </div>
      </div>
    </aside>
  )
}
