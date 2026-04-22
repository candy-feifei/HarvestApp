/** 仅用于展示侧栏等 UI，不用于鉴权。 */
export function parseJwtPayloadJson(
  token: string | null,
): { sub?: string; email?: string } | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(b64)
    return JSON.parse(json) as { sub?: string; email?: string }
  } catch {
    return null
  }
}

export function emailToInitials(email: string): string {
  const local = email.split('@')[0] ?? email
  const parts = local.split(/[._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  }
  return local.slice(0, 2).toUpperCase() || '?'
}
