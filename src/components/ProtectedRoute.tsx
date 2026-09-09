import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingScreen } from './Loading'

export function ProtectedRoute({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) {
  const { user, profile, loading, isAdmin } = useAuth()
  const location = useLocation()
  const [waited, setWaited] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 4000)
    return () => clearTimeout(t)
  }, [])

  if (loading && !waited) return <LoadingScreen label="Tuning your station…" />
  if (!user) {
    return <Navigate to={adminOnly ? '/admin/login' : '/login'} state={{ from: location.pathname }} replace />
  }
  // If profile hasn't loaded yet but session exists, allow render (role check happens below once known)
  if (adminOnly && profile && !isAdmin) {
    return <Navigate to="/home" replace />
  }
  if (adminOnly && !profile && waited) {
    return <Navigate to="/home" replace />
  }
  return children
}
