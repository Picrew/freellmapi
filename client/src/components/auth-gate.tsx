import { useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, setToken, UNAUTHORIZED_EVENT } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LanguageToggle } from '@/components/language-toggle'
import { useI18n } from '@/lib/i18n'

interface AuthStatus {
  needsSetup: boolean
  authenticated: boolean
  email: string | null
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="fixed right-4 top-4">
        <LanguageToggle />
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}

function AuthForm({ mode, onAuthed }: { mode: 'setup' | 'login'; onAuthed: () => void }) {
  const { t } = useI18n()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isSetup = mode === 'setup'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await apiFetch<{ token: string }>(isSetup ? '/api/auth/setup' : '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: account, password }),
      })
      setToken(res.token)
      onAuthed()
    } catch (err) {
      setError(t((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Centered>
      <div className="mb-6 flex items-center gap-2">
        <span className="inline-block size-2 rounded-full bg-foreground" />
        <span className="font-semibold tracking-tight text-sm">FreeLLMAPI</span>
      </div>
      <div className="rounded-lg border bg-card p-6">
        <h1 className="text-base font-medium">{isSetup ? t('Create your account') : t('Sign in')}</h1>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          {isSetup
            ? t('Set the account and password that will protect this dashboard.')
            : t('Sign in to manage your keys, routing, and analytics.')}
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="auth-account">{t('Account')}</Label>
            <Input
              id="auth-account"
              type="text"
              autoComplete="username"
              value={account}
              onChange={e => setAccount(e.target.value)}
              placeholder="Jayden"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="auth-password">{t('Password')}</Label>
            <Input
              id="auth-password"
              type="password"
              autoComplete={isSetup ? 'new-password' : 'current-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={isSetup ? t('at least 8 characters') : t('your password')}
            />
          </div>
          {error && <p className="text-destructive text-xs">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !account.trim() || !password}>
            {busy ? (isSetup ? t('Creating…') : t('Signing in…')) : isSetup ? t('Create account') : t('Sign in')}
          </Button>
        </form>
      </div>
    </Centered>
  )
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery<AuthStatus>({
    queryKey: ['auth-status'],
    queryFn: () => apiFetch('/api/auth/status'),
    retry: false,
  })

  useEffect(() => {
    const handler = () => { refetch() }
    window.addEventListener(UNAUTHORIZED_EVENT, handler)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler)
  }, [refetch])

  function onAuthed() {
    // New session: drop any cached (unauthenticated) data and re-check status.
    queryClient.invalidateQueries()
    refetch()
  }

  if (isLoading) return <Centered><p className="text-sm text-muted-foreground text-center">{t('Loading…')}</p></Centered>
  if (isError || !data) {
    return (
      <Centered>
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
          {t("Can't reach the server. Make sure the backend is running")} (<code className="font-mono">npm run dev</code>).
        </div>
      </Centered>
    )
  }

  if (data.needsSetup) return <AuthForm mode="setup" onAuthed={onAuthed} />
  if (!data.authenticated) return <AuthForm mode="login" onAuthed={onAuthed} />

  return <>{children}</>
}
