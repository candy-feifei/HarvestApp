import { describe, expect, it } from 'vitest'
import { SUPPORTED_CURRENCIES, currencyLabel } from './currencies'

describe('currencies', () => {
  it('currencyLabel: 已知代码返回英文标签', () => {
    expect(currencyLabel('USD')).toBe('United States Dollar')
    expect(currencyLabel('CNY')).toBe('Chinese Yuan')
  })

  it('currencyLabel: 未知代码原样返回', () => {
    expect(currencyLabel('XYZ')).toBe('XYZ')
  })

  it('SUPPORTED_CURRENCIES: code 为大写', () => {
    expect(SUPPORTED_CURRENCIES.every((c) => c.code === c.code.toUpperCase())).toBe(
      true,
    )
  })
})
