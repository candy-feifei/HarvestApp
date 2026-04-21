/** sessionStorage 键名（方案 B：仅当前标签页，关标签即清） */
export const ACCESS_TOKEN_STORAGE_KEY = 'harvestapp_access_token'

export const AUTH_EXPIRED_EVENT = 'harvestapp:auth-expired'

export function getAccessToken(): string | null {
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setAccessToken(token: string) {
  sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token)
}

export function clearAccessToken() {
  sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
}

export function notifyAuthExpired() {
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
}
