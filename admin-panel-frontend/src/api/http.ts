function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? ''
}

function readXsrfToken(): string | null {
  const prefix = 'XSRF-TOKEN='
  for (const part of document.cookie.split(';')) {
    const p = part.trim()
    if (p.startsWith(prefix)) {
      return decodeURIComponent(p.slice(prefix.length))
    }
  }
  return null
}

/**
 * Fetch к API с cookie сессии и CSRF-заголовком для небезопасных методов.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${apiBase()}${path}`
  const headers = new Headers(init.headers)
  const method = (init.method ?? 'GET').toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    const xsrf = readXsrfToken()
    if (xsrf) {
      headers.set('X-XSRF-TOKEN', xsrf)
    }
  }
  return fetch(url, { ...init, headers, credentials: 'include' })
}
