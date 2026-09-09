import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AudioLines, ShieldCheck } from 'lucide-react'
import { ButtonSpinner } from '../../components/Loading'
import { signIn } from '../../services/authService'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../utils'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      const { data } = await supabase.auth.getUser()
      let role = 'user'
      if (data.user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
        role = (profile as { role?: string } | null)?.role ?? 'user'
      }
      if (role !== 'admin') {
        await supabase.auth.signOut()
        setError('This account does not have admin access.')
        return
      }
      toast.success('Welcome to the console')
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(friendlyError(err, 'Admin login failed.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="glass rounded-3xl p-8 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-primary to-aqua shadow-glow">
              <AudioLines className="h-6 w-6 text-white" />
            </span>
            <div>
              <p className="font-display text-xl font-extrabold">Waveora Console</p>
              <p className="flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-aqua">
                <ShieldCheck className="h-3.5 w-3.5" /> Admin login
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/60">
            Sign in with an admin account (Supabase Auth + <code className="text-aqua">profiles.role = admin</code>). No hardcoded credentials.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            {error && (
              <div className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose" role="alert">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="a-email" className="mb-1.5 block text-sm font-medium text-white/80">Admin email</label>
              <input
                id="a-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@waveora.app"
                autoComplete="username"
                className="w-full rounded-xl border border-line bg-abyss px-4 py-3 text-sm outline-none placeholder:text-white/30 focus:border-primary/60"
                required
              />
            </div>
            <div>
              <label htmlFor="a-pw" className="mb-1.5 block text-sm font-medium text-white/80">Password</label>
              <input
                id="a-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl border border-line bg-abyss px-4 py-3 text-sm outline-none placeholder:text-white/30 focus:border-primary/60"
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-deep px-4 py-3 text-sm font-bold shadow-glow hover:brightness-110 disabled:opacity-60 focus-ring"
            >
              {busy && <ButtonSpinner />} {busy ? 'Verifying…' : 'Access dashboard'}
            </button>
          </form>
          <div className="mt-6 flex items-center justify-between text-sm">
            <Link to="/login" className="text-white/55 hover:text-white">User login</Link>
            <Link to="/home" className="text-white/55 hover:text-white">← Back to app</Link>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-white/35">
          First admin? Create an account, then set <code>role='admin'</code> in Supabase (see README).
        </p>
      </div>
    </div>
  )
}
