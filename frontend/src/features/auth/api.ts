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
