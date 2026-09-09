import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AuthShell } from '../../components/AuthShell'
import { ButtonSpinner } from '../../components/Loading'
import { sendPasswordReset } from '../../services/authService'
import { friendlyError } from '../../utils'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    setBusy(true)
    try {
      const redirectTo = `${window.location.origin}/reset-password`
      await sendPasswordReset(email.trim(), redirectTo)
      setSent(true)
      toast.success('Reset link sent — check your inbox')
    } catch (err) {
      setError(friendlyError(err, 'Could not send reset email.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Reset password" subtitle="Enter your email and we'll send you a reset link.">
      {sent ? (
        <div className="rounded-2xl border border-flame/30 bg-flame/10 p-5 text-sm">
          <p className="font-semibold">Check your inbox</p>
          <p className="mt-1 text-white/70">
            If an account exists for <span className="text-white">{email}</span>, a password reset link is on its way.
          </p>
          <Link to="/login" className="mt-4 inline-block font-semibold text-flame hover:text-flame-soft">
            Back to login
          </Link>
        </div>
      ) : (
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none placeholder:text-white/30 focus:border-primary/60"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-deep px-4 py-3 text-sm font-bold shadow-glow hover:brightness-110 disabled:opacity-60 focus-ring"
          >
            {busy && <ButtonSpinner />} {busy ? 'Sending…' : 'Send reset link'}
          </button>
          <p className="text-center text-sm text-white/60">
            <Link to="/login" className="hover:text-white">Back to login</Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}
