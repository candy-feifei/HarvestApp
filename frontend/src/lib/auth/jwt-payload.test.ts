import { describe, expect, it } from 'vitest'
import { emailToInitials, parseJwtPayloadJson } from './jwt-payload'

function makeToken(payload: Record<string, string>) {
  const json = JSON.stringify(payload)
  const b64 = btoa(json)
  const b64url = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `header.${b64url}.sig`
}

describe('parseJwtPayloadJson', () => {
  it('token 为空返回 null', () => {
    expect(parseJwtPayloadJson(null)).toBeNull()
  })

  it('分段不足返回 null', () => {
    expect(parseJwtPayloadJson('not-a-jwt')).toBeNull()
  })

  it('合法 payload 解析为对象', () => {
    const token = makeToken({ sub: 'u1', email: 'a@b.com' })
    expect(parseJwtPayloadJson(token)).toEqual({
      sub: 'u1',
      email: 'a@b.com',
    })
  })

  it('非法 base64/json 返回 null', () => {
    expect(parseJwtPayloadJson('a.!!!.c')).toBeNull()
  })
})

describe('emailToInitials', () => {
  it('local 含分隔符时取两段首字母', () => {
    expect(emailToInitials('first.last@example.com')).toBe('FL')
    expect(emailToInitials('a_b@c.d')).toBe('AB')
  })

  it('无分隔符时取 local 前两位大写', () => {
    expect(emailToInitials('solo@x.com')).toBe('SO')
  })

  it('过短 local 仍尽力返回', () => {
    expect(emailToInitials('x@y.com')).toBe('X')
  })
})
