import type { MeUser } from '../types/auth'
import { apiFetch } from './http'

export async function authBootstrap(): Promise<void> {
  const res = await apiFetch('/api/auth/bootstrap', { method: 'GET' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
}

export async function authLogin(username: string, password: string): Promise<void> {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
}

export async function authLogout(): Promise<void> {
  const res = await apiFetch('/api/auth/logout', { method: 'POST' })
  if (!res.ok && res.status !== 401) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
}

export async function authMe(): Promise<{ ok: true; user: MeUser } | { ok: false }> {
  const res = await apiFetch('/api/auth/me', { method: 'GET' })
  if (res.status === 401) {
    return { ok: false }
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  const user = (await res.json()) as MeUser
  return { ok: true, user }
}
