import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('合并 class 字符串', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('tailwind 冲突时由 tailwind-merge 保留后者', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('忽略 falsy 输入', () => {
    expect(cn('px-2', false, null, undefined, 'py-1')).toBe('px-2 py-1')
  })
})
