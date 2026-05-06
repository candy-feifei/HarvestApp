import { afterEach, describe, expect, it, vi } from 'vitest'

describe('getPublicApiBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('未配置或空串时返回空字符串', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    const { getPublicApiBaseUrl } = await import('./public-env')
    expect(getPublicApiBaseUrl()).toBe('')
  })

  it('读取 VITE_API_BASE_URL 并去掉末尾斜杠', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com/')
    const { getPublicApiBaseUrl } = await import('./public-env')
    expect(getPublicApiBaseUrl()).toBe('https://api.example.com')
  })
})
