import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getPublicApiBaseUrl = vi.hoisted(() => vi.fn(() => 'http://127.0.0.1:3000'))
const getAccessToken = vi.hoisted(() => vi.fn(() => null as string | null))
const clearAccessToken = vi.hoisted(() => vi.fn())
const notifyAuthExpired = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/public-env', () => ({
  getPublicApiBaseUrl,
}))

vi.mock('@/lib/auth/access-token', () => ({
  getAccessToken,
  clearAccessToken,
  notifyAuthExpired,
}))

import { ApiError, apiRequest } from './http'

function mockFetchResponse(res: Partial<Response> & { text?: () => Promise<string> }) {
  return res as Response
}

describe('apiRequest', () => {
  beforeEach(() => {
    getPublicApiBaseUrl.mockReturnValue('http://127.0.0.1:3000')
    getAccessToken.mockReturnValue(null)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => '{"a":1}',
        }),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('成功时解析 JSON 并返回', async () => {
    const data = await apiRequest<{ a: number }>('/x', { method: 'GET' })
    expect(data).toEqual({ a: 1 })
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/x',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('有 access_token 时附加 Authorization', async () => {
    getAccessToken.mockReturnValue('abc')
    await apiRequest('/p', { method: 'GET' })
    const init = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit
    const h = init.headers as Headers
    expect(h.get('Authorization')).toBe('Bearer abc')
  })

  it('204 或空 body 时返回 undefined', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          ok: true,
          status: 204,
          statusText: 'No Content',
          text: async () => '',
        }),
      ),
    )
    const out = await apiRequest('/n')
    expect(out).toBeUndefined()
  })

  it('401 时清理 token 并通知过期', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: async () => '{"message":"nope"}',
        }),
      ),
    )
    await expect(apiRequest('/need-auth')).rejects.toBeInstanceOf(ApiError)
    expect(clearAccessToken).toHaveBeenCalled()
    expect(notifyAuthExpired).toHaveBeenCalled()
  })

  it('业务错误抛出 ApiError 并带 message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          text: async () => '{"message":"bad input"}',
        }),
      ),
    )
    try {
      await apiRequest('/bad')
      expect.fail('should throw')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).message).toBe('bad input')
      expect((e as ApiError).status).toBe(400)
    }
  })
})
