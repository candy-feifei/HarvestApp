import { apiRequest } from '@/lib/api/http'

export type LoginResponse = {
  access_token: string
  token_type: string
  expires_in: number
}

export function loginRequest(email: string, password: string) {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function registerRequest(
  email: string,
  password: string,
  name?: string,
) {
  return apiRequest<LoginResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  })
}

export function forgotPasswordRequest(email: string) {
  return apiRequest<{ sent: true }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function resetPasswordRequest(token: string, password: string) {
  return apiRequest<LoginResponse>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
}

export function changePasswordRequest(body: {
  currentPassword: string
  newPassword: string
}) {
  return apiRequest<{ changed: true }>('/account/change-password', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
