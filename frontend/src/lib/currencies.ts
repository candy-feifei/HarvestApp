/** 常用货币（与 ISO-4217 一致，值大写） */
export const SUPPORTED_CURRENCIES: { code: string; label: string }[] = [
  { code: 'USD', label: 'United States Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'CNY', label: 'Chinese Yuan' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'CHF', label: 'Swiss Franc' },
  { code: 'HKD', label: 'Hong Kong Dollar' },
  { code: 'SGD', label: 'Singapore Dollar' },
]

export function currencyLabel(code: string) {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.label ?? code
}
