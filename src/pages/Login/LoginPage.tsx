import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AuthShell } from '../../components/AuthShell'
import { ButtonSpinner } from '../../components/Loading'
import { signIn } from '../../services/authService'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../utils'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      // Role-based redirect
      const { data } = await supabase.auth.getUser()
      let role = 'user'
      if (data.user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
        role = (profile as { role?: string } | null)?.role ?? 'user'
      }
      toast.success('Welcome back!')
      navigate(role === 'admin' ? '/admin' : '/home', { replace: true })
    } catch (err) {
      setError(friendlyError(err, 'Login failed. Check your email and password.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to keep riding your sound wave.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && (
          <div className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose" role="alert">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-white/80">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none transition placeholder:text-white/30 focus:border-primary/60"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-white/80">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none transition placeholder:text-white/30 focus:border-primary/60"
            required
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-deep px-4 py-3 text-sm font-bold shadow-glow transition hover:brightness-110 disabled:opacity-60 focus-ring"
        >
          {busy && <ButtonSpinner />} {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <div className="mt-6 flex items-center justify-between text-sm">
        <Link to="/forgot-password" className="text-white/60 hover:text-white focus-ring rounded">
          Forgot password?
        </Link>
        <Link to="/signup" className="font-semibold text-flame hover:text-flame-soft focus-ring rounded">
          Create account
        </Link>
      </div>
      <p className="mt-8 text-center text-xs text-white/40">
        Are you a curator? <Link to="/admin/login" className="underline hover:text-white">Go to admin login</Link>
      </p>
    </AuthShell>
  )
}
