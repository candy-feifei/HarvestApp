import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '@/lib/api/http'
import { currencyLabel, SUPPORTED_CURRENCIES } from '@/lib/currencies'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  createClient,
  fetchOrganizationContext,
  type OrganizationContext,
} from '@/features/clients/api'
import {
  fieldWrap,
  inputCls,
  invoiceDueSelectValue,
  labelCls,
  selectCls,
  cnTextarea,
  NET_PRESETS,
  NET_CUSTOM_PLACEHOLDER_DAYS,
} from '@/features/clients/client-form-helpers'

export function NewClientPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [ctx, setCtx] = useState<OrganizationContext | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')

  const [useAccountCurrency, setUseAccountCurrency] = useState(true)
  const [currencyCode, setCurrencyCode] = useState('USD')

  const [invoiceDueMode, setInvoiceDueMode] = useState<
    'UPON_RECEIPT' | 'NET_DAYS'
  >('UPON_RECEIPT')
  const [invoiceNetDays, setInvoiceNetDays] = useState(30)

  const [taxRate, setTaxRate] = useState('')
  const [secondTaxEnabled, setSecondTaxEnabled] = useState(false)
  const [secondaryTaxRate, setSecondaryTaxRate] = useState('')
  const [discountRate, setDiscountRate] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchOrganizationContext()
      .then((c) => {
        if (!cancelled) {
          setCtx(c)
          setCurrencyCode(c.organization.defaultCurrency)
        }
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError) {
          if (err.status === 401) {
            setLoadError('Your session has expired. Please sign in again.')
            return
          }
          const body = err.body
          const msg =
            typeof body === 'object' &&
            body !== null &&
            'message' in body
              ? String((body as { message: unknown }).message)
              : err.message
          setLoadError(
            err.status === 403
              ? `Could not load organization: ${msg || 'Access denied'}.`
              : `Could not load organization: ${msg || err.message}`,
          )
          return
        }
        setLoadError('Network error. Check that the server is running.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  function parseOptionalPercent(raw: string): number | undefined {
    const t = raw.trim()
    if (t === '') return undefined
    const n = Number(t)
    if (Number.isNaN(n)) return undefined
    return n
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError('Please enter a client name.')
      return
    }
    if (invoiceDueMode === 'NET_DAYS' && (invoiceNetDays < 1 || invoiceNetDays > 180)) {
      setFormError('Net days must be between 1 and 180.')
      return
    }
    if (secondTaxEnabled) {
      const s = parseOptionalPercent(secondaryTaxRate)
      if (s == null) {
        setFormError('Enter a value for the second tax rate.')
        return
      }
    }
    setSubmitting(true)
    try {
      await createClient({
        name: name.trim(),
        address: address.trim() || undefined,
        currency: useAccountCurrency ? null : currencyCode,
        invoiceDueMode,
        invoiceNetDays:
          invoiceDueMode === 'NET_DAYS' ? invoiceNetDays : undefined,
        taxRate: parseOptionalPercent(taxRate),
        secondaryTaxEnabled: secondTaxEnabled,
        secondaryTaxRate: secondTaxEnabled
          ? parseOptionalPercent(secondaryTaxRate)
          : undefined,
        discountRate: parseOptionalPercent(discountRate),
      })
      await queryClient.invalidateQueries({ queryKey: ['clients'] })
      navigate('/clients', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        const msg = err.body
        if (typeof msg === 'object' && msg && 'message' in msg) {
          setFormError(
            String((msg as { message: string }).message) ||
              'Save failed. Please try again.',
          )
        } else {
          setFormError(err.message || 'Save failed. Please try again.')
        }
      } else {
        setFormError('Network error. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
        {loadError}
      </div>
    )
  }

  const accountCurrency = ctx?.organization.defaultCurrency ?? 'USD'

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          New client
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          After you add a client, you can create projects and contacts.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-0">
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-[200px_1fr] sm:items-start">
          <label className={labelCls} htmlFor="client-name">
            Client name
          </label>
          <div className={fieldWrap}>
            <input
              id="client-name"
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              required
            />
          </div>

          <label className={labelCls} htmlFor="client-address">
            Address
          </label>
          <div className={fieldWrap}>
            <textarea
              id="client-address"
              className={cnTextarea(inputCls)}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={4}
            />
          </div>

          <label className={labelCls} htmlFor="client-currency">
            Currency
          </label>
          <div className={fieldWrap}>
            <select
              id="client-currency"
              className={selectCls}
              value={useAccountCurrency ? '__ACCOUNT__' : currencyCode}
              onChange={(e) => {
                const v = e.target.value
                if (v === '__ACCOUNT__') {
                  setUseAccountCurrency(true)
                } else {
                  setUseAccountCurrency(false)
                  setCurrencyCode(v)
                }
              }}
            >
              <option value="__ACCOUNT__">
                Same as account ({currencyLabel(accountCurrency)} – {accountCurrency})
              </option>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label} – {c.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <hr className="my-8 border-border" />

        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-[200px_1fr] sm:items-start">
          <label className={labelCls} htmlFor="invoice-due">
            Invoice payment terms
          </label>
          <div className={cn(fieldWrap, 'space-y-2')}>
            <select
              id="invoice-due"
              className={selectCls}
              value={invoiceDueSelectValue(
                invoiceDueMode,
                invoiceNetDays,
              )}
              onChange={(e) => {
                const v = e.target.value
                if (v === 'UPON_RECEIPT') {
                  setInvoiceDueMode('UPON_RECEIPT')
                  return
                }
                if (v === 'NET_CUSTOM') {
                  setInvoiceDueMode('NET_DAYS')
                  setInvoiceNetDays((prev) =>
                    (NET_PRESETS as readonly number[]).includes(prev)
                      ? NET_CUSTOM_PLACEHOLDER_DAYS
                      : prev,
                  )
                  return
                }
                if (v.startsWith('NET_')) {
                  setInvoiceDueMode('NET_DAYS')
                  setInvoiceNetDays(Number(v.slice(4)))
                }
              }}
            >
              <option value="UPON_RECEIPT">Due on receipt</option>
              <option value="NET_15">Net 15</option>
              <option value="NET_30">Net 30</option>
              <option value="NET_45">Net 45</option>
              <option value="NET_60">Net 60</option>
              <option value="NET_CUSTOM">Net N (custom days)</option>
            </select>
            {invoiceDueMode === 'NET_DAYS' &&
              invoiceDueSelectValue(
                invoiceDueMode,
                invoiceNetDays,
              ) === 'NET_CUSTOM' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Days</span>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    className="w-24 rounded-md border border-border px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    value={invoiceNetDays}
                    onChange={(e) =>
                      setInvoiceNetDays(Number(e.target.value))
                    }
                  />
                </div>
              )}
          </div>

          <label className={labelCls} htmlFor="tax-1">
            Tax rate
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="tax-1"
              className="w-24 rounded-md border border-border bg-white px-2 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              inputMode="decimal"
              placeholder="0"
            />
            <span className="text-sm text-muted-foreground">%</span>
            {!secondTaxEnabled && (
              <button
                type="button"
                className="ml-1 text-sm font-medium text-primary hover:underline"
                onClick={() => setSecondTaxEnabled(true)}
              >
                Add second tax rate
              </button>
            )}
          </div>

          {secondTaxEnabled && (
            <>
              <span className={labelCls}>Second tax rate</span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="w-24 rounded-md border border-border bg-white px-2 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                  value={secondaryTaxRate}
                  onChange={(e) => setSecondaryTaxRate(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
                <span className="text-sm text-muted-foreground">%</span>
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => {
                    setSecondTaxEnabled(false)
                    setSecondaryTaxRate('')
                  }}
                >
                  Remove
                </button>
              </div>
            </>
          )}

          <label className={labelCls} htmlFor="discount">
            Discount
          </label>
          <div className="flex items-center gap-2">
            <input
              id="discount"
              className="w-24 rounded-md border border-border bg-white px-2 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              value={discountRate}
              onChange={(e) => setDiscountRate(e.target.value)}
              inputMode="decimal"
              placeholder="0"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>

        {formError && (
          <p
            className="mt-6 text-sm text-red-600"
            role="alert"
          >
            {formError}
          </p>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={submitting}
            className="h-10 min-w-[120px] px-5 shadow-sm"
          >
            {submitting ? 'Saving…' : 'Save client'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
