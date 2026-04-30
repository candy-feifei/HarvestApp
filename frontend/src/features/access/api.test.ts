import { describe, expect, it } from 'vitest'
import { rolesResourcePath } from './api'

describe('access api', () => {
  it('rolesResourcePath', () => {
    expect(rolesResourcePath).toBe('/roles')
  })
})
