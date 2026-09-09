import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AuthShell } from '../../components/AuthShell'
import { ButtonSpinner } from '../../components/Loading'
import { updatePassword } from '../../services/authService'
import { friendlyError } from '../../utils'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await updatePassword(password)
      toast.success('Password updated — please log in')
      navigate('/login', { replace: true })
    } catch (err) {
      setError(friendlyError(err, 'Could not update password. The reset link may have expired.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Enter and confirm your new password below.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && (
          <div className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose" role="alert">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="pw" className="mb-1.5 block text-sm font-medium text-white/80">
            New password
          </label>
          <input
            id="pw"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-primary/60"
            required
          />
        </div>
        <div>
          <label htmlFor="pw2" className="mb-1.5 block text-sm font-medium text-white/80">
            Confirm password
          </label>
          <input
            id="pw2"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-primary/60"
            required
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-deep px-4 py-3 text-sm font-bold shadow-glow hover:brightness-110 disabled:opacity-60 focus-ring"
        >
          {busy && <ButtonSpinner />} {busy ? 'Updating…' : 'Update password'}
        </button>
        <p className="text-center text-sm text-white/60">
          <Link to="/login" className="hover:text-white">Back to login</Link>
        </p>
      </form>
    </AuthShell>
  )
}
