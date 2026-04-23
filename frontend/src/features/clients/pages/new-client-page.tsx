import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
            setLoadError('登录已过期，请重新登录后再试。')
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
              ? `无法获取组织：${msg || '无权限'}`
              : `无法加载组织信息：${msg || err.message}`,
          )
          return
        }
        setLoadError('网络异常，请检查后端是否已启动。')
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
      setFormError('请填写客户名称。')
      return
    }
    if (invoiceDueMode === 'NET_DAYS' && (invoiceNetDays < 1 || invoiceNetDays > 180)) {
      setFormError('账期天数应在 1–180 之间。')
      return
    }
    if (secondTaxEnabled) {
      const s = parseOptionalPercent(secondaryTaxRate)
      if (s == null) {
        setFormError('启用第二税率时请填写第二税率。')
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
              '保存失败，请重试。',
          )
        } else {
          setFormError(err.message || '保存失败，请重试。')
        }
      } else {
        setFormError('网络错误，请重试。')
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
          新建客户
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          添加客户后，即可创建项目与联系人。
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-0">
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-[200px_1fr] sm:items-start">
          <label className={labelCls} htmlFor="client-name">
            客户名称
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
            地址
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
            首选货币
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
                与账户一致（{currencyLabel(accountCurrency)} – {accountCurrency}）
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
            发票付款期限
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
                  return
                }
                if (v.startsWith('NET_')) {
                  setInvoiceDueMode('NET_DAYS')
                  setInvoiceNetDays(Number(v.slice(4)))
                }
              }}
            >
              <option value="UPON_RECEIPT">收到时付款</option>
              <option value="NET_15">发票后 15 天</option>
              <option value="NET_30">发票后 30 天</option>
              <option value="NET_45">发票后 45 天</option>
              <option value="NET_60">发票后 60 天</option>
              <option value="NET_CUSTOM">发票后 N 天（自定义）</option>
            </select>
            {invoiceDueMode === 'NET_DAYS' &&
              invoiceDueSelectValue(
                invoiceDueMode,
                invoiceNetDays,
              ) === 'NET_CUSTOM' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">天数</span>
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
            税率
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
                启用第二税率
              </button>
            )}
          </div>

          {secondTaxEnabled && (
            <>
              <span className={labelCls}>第二税率</span>
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
                  移除
                </button>
              </div>
            </>
          )}

          <label className={labelCls} htmlFor="discount">
            折扣
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
            {submitting ? '保存中…' : '保存客户'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => navigate(-1)}
          >
            取消
          </Button>
          <Link
            to="/clients"
            className="ml-auto text-sm text-muted-foreground hover:text-foreground"
          >
            返回列表
          </Link>
        </div>
      </form>
    </div>
  )
}
