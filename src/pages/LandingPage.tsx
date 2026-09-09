import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingScreen } from '../components/Loading'

export function LandingPage() {
  const { user, profile, loading } = useAuth()
  if (loading) return <LoadingScreen label="Opening Waveora…" />
  if (user) {
    return <Navigate to={profile?.role === 'admin' ? '/admin' : '/home'} replace />
  }
  return <Navigate to="/login" replace />
}
