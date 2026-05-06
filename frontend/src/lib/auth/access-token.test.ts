import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ACCESS_TOKEN_STORAGE_KEY,
  AUTH_EXPIRED_EVENT,
  clearAccessToken,
  getAccessToken,
  notifyAuthExpired,
  setAccessToken,
} from './access-token'

describe('access-token', () => {
  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('set / get / clear 读写 sessionStorage', () => {
    expect(getAccessToken()).toBeNull()
    setAccessToken('tok')
    expect(sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBe('tok')
    expect(getAccessToken()).toBe('tok')
    clearAccessToken()
    expect(getAccessToken()).toBeNull()
  })

  it('notifyAuthExpired 派发自定义事件', () => {
    const spy = vi.fn()
    window.addEventListener(AUTH_EXPIRED_EVENT, spy)
    notifyAuthExpired()
    expect(spy).toHaveBeenCalledTimes(1)
    window.removeEventListener(AUTH_EXPIRED_EVENT, spy)
  })
})
