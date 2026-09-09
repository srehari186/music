import { NavLink } from 'react-router-dom'
import { Heart, Home, Library, Search, User } from 'lucide-react'

const cls = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-[11px] font-medium focus-ring ${
    isActive ? 'text-white' : 'text-white/55 hover:text-white'
  }`

export function MobileNavigation() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-abyss/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Mobile"
    >
      <div className="grid grid-cols-5 gap-1 px-2 py-2">
        <NavLink to="/home" className={cls} aria-label="Home">
          <Home className="h-5 w-5" /> Home
        </NavLink>
        <NavLink to="/search" className={cls} aria-label="Search">
          <Search className="h-5 w-5" /> Search
        </NavLink>
        <NavLink to="/library" className={cls} aria-label="Library">
          <Library className="h-5 w-5" /> Library
        </NavLink>
        <NavLink to="/liked" className={cls} aria-label="Liked">
          <Heart className="h-5 w-5" /> Liked
        </NavLink>
        <NavLink to="/profile" className={cls} aria-label="Profile">
          <User className="h-5 w-5" /> You
        </NavLink>
      </div>
    </nav>
  )
}
