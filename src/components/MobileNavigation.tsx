import { NavLink } from 'react-router-dom'
import { Heart, Home, Library, Search, User } from 'lucide-react'

function Tab({
  to,
  label,
  children
}: {
  to: string
  label: string
  children: (active: boolean) => React.ReactNode
}) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-semibold transition focus-ring ${
          isActive ? 'text-white' : 'text-white/50 hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`grid h-7 w-14 place-items-center rounded-full transition ${
              isActive ? 'bg-gradient-to-r from-primary to-primary-deep shadow-glow' : 'bg-transparent'
            }`}
          >
            {children(isActive)}
          </span>
          {label}
        </>
      )}
    </NavLink>
  )
}

export function MobileNavigation() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-abyss/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Mobile"
    >
      <div className="grid grid-cols-5 gap-1 px-3 pb-1 pt-2">
        <Tab to="/home" label="Home">
          {() => <Home className="h-5 w-5" />}
        </Tab>
        <Tab to="/search" label="Search">
          {() => <Search className="h-5 w-5" />}
        </Tab>
        <Tab to="/library" label="Library">
          {() => <Library className="h-5 w-5" />}
        </Tab>
        <Tab to="/liked" label="Liked">
          {() => <Heart className="h-5 w-5" />}
        </Tab>
        <Tab to="/profile" label="You">
          {() => <User className="h-5 w-5" />}
        </Tab>
      </div>
    </nav>
  )
}
