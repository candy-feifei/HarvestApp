import { describe, expect, it } from 'vitest'
import { dashboardResourcePath } from './api'

describe('dashboard api', () => {
  it('dashboardResourcePath', () => {
    expect(dashboardResourcePath).toBe('/dashboard')
  })
})
