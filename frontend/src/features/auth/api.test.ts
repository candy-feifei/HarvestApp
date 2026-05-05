import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  changePasswordRequest,
  forgotPasswordRequest,
  loginRequest,
  registerRequest,
  resetPasswordRequest,
} from './api'

const apiRequest = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/http', () => ({
  apiRequest,
  ApiError: class ApiError extends Error {
    status = 0
    body: unknown
    constructor(message: string, status: number, body: unknown) {
      super(message)
      this.name = 'ApiError'
      this.status = status
      this.body = body
    }
  },
}))

describe('auth api', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('loginRequest: POST /auth/login 与 JSON body', async () => {
    apiRequest.mockResolvedValue({
      access_token: 't',
      token_type: 'Bearer',
      expires_in: 3600,
    })
    await loginRequest('User@Example.com', 'secret123')
    expect(apiRequest).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'User@Example.com', password: 'secret123' }),
    })
  })

  it('forgotPasswordRequest: POST /auth/forgot-password', async () => {
    apiRequest.mockResolvedValue({ sent: true })
    await forgotPasswordRequest('a@b.com')
    expect(apiRequest).toHaveBeenCalledWith('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com' }),
    })
  })

  it('registerRequest: POST /auth/register，可选 name', async () => {
    apiRequest.mockResolvedValue({
      access_token: 't',
      token_type: 'Bearer',
      expires_in: 1,
    })
    await registerRequest('n@e.com', 'pw', '  N  ')
    expect(apiRequest).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'n@e.com', password: 'pw', name: '  N  ' }),
    })
  })

  it('resetPasswordRequest: POST /auth/reset-password', async () => {
    apiRequest.mockResolvedValue({
      access_token: 't',
      token_type: 'Bearer',
      expires_in: 1,
    })
    await resetPasswordRequest('tok', 'newpw')
    expect(apiRequest).toHaveBeenCalledWith('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'tok', password: 'newpw' }),
    })
  })

  it('changePasswordRequest: POST /account/change-password', async () => {
    apiRequest.mockResolvedValue({ changed: true })
    await changePasswordRequest({ currentPassword: 'a', newPassword: 'b' })
    expect(apiRequest).toHaveBeenCalledWith('/account/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'a', newPassword: 'b' }),
    })
  })
})
