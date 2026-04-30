import { describe, expect, it } from 'vitest'
import { settingsResourcePath } from './api'

describe('settings api', () => {
  it('settingsResourcePath', () => {
    expect(settingsResourcePath).toBe('/settings')
  })
})
