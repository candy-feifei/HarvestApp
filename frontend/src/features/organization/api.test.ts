import { describe, expect, it } from 'vitest'
import { organizationResourcePath } from './api'

describe('organization api', () => {
  it('organizationResourcePath 与后端组织模块路径对齐', () => {
    expect(organizationResourcePath).toBe('/organizations')
  })
})
