import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { authBootstrap, authLogin, authMe } from '../../api/authClient'
import './LoginPage.css'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const stateFrom = (location.state as { from?: string } | undefined)?.from
  const from =
    stateFrom && stateFrom !== '/login' ? stateFrom : '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(true)
  const [alreadyIn, setAlreadyIn] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await authBootstrap()
        const me = await authMe()
        if (cancelled) return
        if (me.ok) setAlreadyIn(true)
      } catch {
        /* остаёмся на форме */
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await authBootstrap()
      await authLogin(username.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setBusy(false)
    }
  }

  if (checking) {
    return (
      <div className="login-page" role="status">
        <p className="login-page__hint">Загрузка…</p>
      </div>
    )
  }
  if (alreadyIn) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="login-page">
      <div className="login-page__card">
        <h1 className="login-page__title">Вход</h1>
        <p className="login-page__hint">Введите логин и пароль администратора.</p>
        <form className="login-page__form" onSubmit={onSubmit}>
          <label className="login-page__field">
            <span>Логин</span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
              required
            />
          </label>
          <label className="login-page__field">
            <span>Пароль</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              required
            />
          </label>
          {error ? <p className="login-page__error">{error}</p> : null}
          <button type="submit" className="login-page__submit" disabled={busy}>
            {busy ? 'Вход…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
