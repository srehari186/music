import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ClipboardList, Loader2, XCircle } from 'lucide-react'
import { ButtonSpinner } from '../../components/Loading'
import { classifyAudioUrl } from '../../utils'
import { diagnoseMegaLink, type MegaDiagStage } from '../../services/megaService'

export function MegaCheckPage() {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [stages, setStages] = useState<MegaDiagStage[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onRun = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setStages(null)
    const check = classifyAudioUrl(url)
    if (!check.playable) {
      setError(check.warning ?? 'Invalid link.')
      return
    }
    setBusy(true)
    try {
      setStages(await diagnoseMegaLink(url.trim()))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diagnosis failed.')
    } finally {
      setBusy(false)
    }
  }

  const allOk = stages !== null && stages.every((s) => s.ok)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link to="/admin/songs" className="text-sm text-white/55 hover:text-white">← Back to songs</Link>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight">
          <ClipboardList className="h-7 w-7 text-flame" /> Check MEGA link
        </h1>
        <p className="mt-1 text-sm text-white/55">
          Runs a link through every playback stage — format, metadata, download URL, range fetch,
          decrypt, duration, playback mode — and shows exactly which step fails.
        </p>
      </div>

      <form onSubmit={onRun} className="glass space-y-4 rounded-3xl p-6" noValidate>
        {error && (
          <div className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose" role="alert">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="mc-url" className="mb-1.5 block text-sm font-medium">MEGA link *</label>
          <input
            id="mc-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://mega.nz/file/…#key… or https://mega.nz/folder/…"
            className="w-full rounded-xl border border-line bg-abyss px-4 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-primary/60"
            required
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-deep px-4 py-3 text-sm font-bold shadow-glow hover:brightness-110 disabled:opacity-60 focus-ring"
        >
          {busy && <ButtonSpinner />} {busy ? 'Running checks…' : 'Run diagnosis'}
        </button>
      </form>

      {busy && !stages && (
        <p className="flex items-center gap-2 text-sm text-white/55" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Contacting MEGA…
        </p>
      )}

      {stages && (
        <section className="glass rounded-3xl p-6" aria-label="Diagnosis results">
          <h2 className={`mb-4 font-display font-bold ${allOk ? 'text-emerald-300' : 'text-amber-200'}`}>
            {allOk ? 'All stages passed — this link should play.' : 'Found the problem — see the failed stage below.'}
          </h2>
          <ol className="space-y-2">
            {stages.map((s, i) => (
              <li key={i} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${s.ok ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-rose/30 bg-rose/10'}`}>
                {s.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-label="Passed" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose" aria-label="Failed" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold">{s.label}</p>
                  <p className="text-white/60">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
