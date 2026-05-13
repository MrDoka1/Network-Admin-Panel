/** Оставляем цифры и точки, до 4 октетов; после 3 цифр в октете следующая цифра начинает новый октет (точка вставляется автоматически). */
export function formatIpv4WhileTyping(input: string): string {
  const parts: string[] = []
  let seg = ''
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '.') {
      if (seg) {
        parts.push(seg.slice(0, 3))
        seg = ''
        if (parts.length >= 4) break
      }
      continue
    }
    if (!/\d/.test(ch)) continue
    if (seg.length >= 3) {
      parts.push(seg.slice(0, 3))
      if (parts.length >= 4) break
      seg = ch
    } else {
      seg += ch
    }
  }
  if (seg && parts.length < 4) parts.push(seg.slice(0, 3))
  let out = parts.slice(0, 4).join('.')
  /* Чтобы точка после октета не «пропадала» в controlled input (192. → снова 192). */
  if (input.endsWith('.') && parts.length > 0 && parts.length < 4) {
    out += '.'
  }
  return out
}

export function parseMaskBits(raw: string, fallback = 24): number {
  const n = Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 1 || n > 32) return fallback
  return n
}

/** Разбор значения с бэка: host и длина префикса (только если после / число 1–32). */
export function splitHostAndCidrMask(
  stored: string | null | undefined,
): { host: string; maskBits: string } {
  const t = (stored ?? '').trim()
  if (!t) return { host: '', maskBits: '24' }
  const slash = t.indexOf('/')
  if (slash < 0) return { host: t, maskBits: '24' }
  const host = t.slice(0, slash).trim()
  const rest = t.slice(slash + 1).trim()
  const m = Number.parseInt(rest, 10)
  if (Number.isFinite(m) && m >= 1 && m <= 32) {
    return { host, maskBits: String(m) }
  }
  return { host: t, maskBits: '24' }
}

export function buildInetCidr(host: string, maskBits: string): string | null {
  const h = host.trim()
  if (!h) return null
  const m = parseMaskBits(maskBits, 24)
  return `${h}/${m}`
}

export function isValidIpv4Dotted(host: string): boolean {
  const h = host.trim()
  if (!h || h.endsWith('.')) return false
  const parts = h.split('.')
  if (parts.length !== 4) return false
  for (const p of parts) {
    if (p === '') return false
    if (!/^\d{1,3}$/.test(p)) return false
    const n = Number.parseInt(p, 10)
    if (!Number.isFinite(n) || n < 0 || n > 255) return false
  }
  return true
}
