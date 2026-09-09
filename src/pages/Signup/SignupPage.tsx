import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AuthShell } from '../../components/AuthShell'
import { ButtonSpinner } from '../../components/Loading'
import { signUp } from '../../services/authService'
import { friendlyError } from '../../utils'

export function SignupPage() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (displayName.trim().length < 2) {
      setError('Please enter a display name (at least 2 characters).')
      return
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      await signUp(email.trim(), password, displayName.trim())
      toast.success('Account created — welcome to Waveora!')
      // No email confirmation required: go straight to home
      navigate('/home', { replace: true })
    } catch (err) {
      setError(friendlyError(err, 'Signup failed. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="No email confirmation needed — start listening right away.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && (
          <div className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose" role="alert">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium text-white/80">
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            autoComplete="nickname"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nova Listener"
            className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none transition placeholder:text-white/30 focus:border-primary/60"
            required
          />
        </div>
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none transition placeholder:text-white/30 focus:border-primary/60"
            required
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-deep px-4 py-3 text-sm font-bold shadow-glow transition hover:brightness-110 disabled:opacity-60 focus-ring"
        >
          {busy && <ButtonSpinner />} {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-white/60">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-flame hover:text-flame-soft">
          Log in
        </Link>
      </p>
    </AuthShell>
  )
}
