import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { authBootstrap, authMe } from '../../api/authClient'

type Props = {
  children: React.ReactNode
}

export function RequireAuth({ children }: Props) {
  const location = useLocation()
  const [phase, setPhase] = useState<'loading' | 'ok' | 'redirect'>('loading')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await authBootstrap()
        const me = await authMe()
        if (cancelled) return
        setPhase(me.ok ? 'ok' : 'redirect')
      } catch {
        if (!cancelled) setPhase('redirect')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [location.key])

  if (phase === 'loading') {
    return (
      <div className="auth-gate" role="status">
        Проверка сессии…
      </div>
    )
  }
  if (phase === 'redirect') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
