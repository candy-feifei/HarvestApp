import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '@/lib/api/http'
import { currencyLabel, SUPPORTED_CURRENCIES } from '@/lib/currencies'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  fieldWrap,
  inputCls,
  invoiceDueSelectValue,
  labelCls,
  selectCls,
  cnTextarea,
} from '@/features/clients/client-form-helpers'
import {
  fetchClient,
  fetchOrganizationContext,
  updateClient,
  type ClientDetail,
  type OrganizationContext,
} from '@/features/clients/api'

function parseOptionalPercent(raw: string): number | undefined {
  const t = raw.trim()
  if (t === '') return undefined
  const n = Number(t)
  if (Number.isNaN(n)) return undefined
  return n
}

type ClientEditFormProps = {
  client: ClientDetail
  ctx: OrganizationContext
  clientId: string
}

function ClientEditForm({ client, ctx, clientId }: ClientEditFormProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const accountCurrency = ctx.organization.defaultCurrency

  const initialMode: 'UPON_RECEIPT' | 'NET_DAYS' =
    client.invoiceDueMode === 'NET_DAYS' ? 'NET_DAYS' : 'UPON_RECEIPT'
  const hasSecond = client.secondaryTaxRate != null

  const [name, setName] = useState(client.name)
  const [address, setAddress] = useState(client.address ?? '')
  const [useAccountCurrency, setUseAccountCurrency] = useState(
    client.currency === null,
  )
  const [currencyCode, setCurrencyCode] = useState(
    client.currency ?? accountCurrency,
  )
  const [invoiceDueMode, setInvoiceDueMode] = useState<
    'UPON_RECEIPT' | 'NET_DAYS'
  >(initialMode)
  const [invoiceNetDays, setInvoiceNetDays] = useState(
    client.invoiceNetDays ?? 30,
  )
  const [taxRate, setTaxRate] = useState(client.taxRate ?? '')
  const [secondTaxEnabled, setSecondTaxEnabled] = useState(hasSecond)
  const [secondaryTaxRate, setSecondaryTaxRate] = useState(
    client.secondaryTaxRate ?? '',
  )
  const [discountRate, setDiscountRate] = useState(client.discountRate ?? '')

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

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
      await updateClient(clientId, {
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
      await queryClient.invalidateQueries({ queryKey: ['client', clientId] })
      navigate('/clients', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        const msg = err.body
        if (typeof msg === 'object' && msg && 'message' in msg) {
          setFormError(
            String((msg as { message: string }).message) || '保存失败，请重试。',
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

  const hasActiveProjects = (client.activeProjects?.length ?? 0) > 0

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px] lg:items-start">
      <form onSubmit={onSubmit} className="min-w-0 space-y-0">
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-[200px_1fr] sm:items-start">
          <label className={labelCls} htmlFor="edit-client-name">
            客户名称
          </label>
          <div className={fieldWrap}>
            <input
              id="edit-client-name"
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              required
            />
          </div>

          <label className={labelCls} htmlFor="edit-client-address">
            地址
          </label>
          <div className={fieldWrap}>
            <textarea
              id="edit-client-address"
              className={cnTextarea(inputCls)}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={4}
            />
          </div>

          <label className={labelCls} htmlFor="edit-currency">
            首选货币
          </label>
          <div className={fieldWrap}>
            <select
              id="edit-currency"
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

        <hr className="my-6 border-border" />

        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-[200px_1fr] sm:items-start">
          <label className={labelCls} htmlFor="edit-invoice-due">
            发票付款期限
          </label>
          <div className={cn(fieldWrap, 'space-y-2')}>
            <select
              id="edit-invoice-due"
              className={selectCls}
              value={invoiceDueSelectValue(invoiceDueMode, invoiceNetDays)}
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
              invoiceDueSelectValue(invoiceDueMode, invoiceNetDays) ===
                'NET_CUSTOM' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">天数</span>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    className="w-24 rounded-md border border-border px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    value={invoiceNetDays}
                    onChange={(e) => setInvoiceNetDays(Number(e.target.value))}
                  />
                </div>
              )}
          </div>

          <label className={labelCls} htmlFor="edit-tax-1">
            税率
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="edit-tax-1"
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

          <label className={labelCls} htmlFor="edit-discount">
            折扣
          </label>
          <div className="flex items-center gap-2">
            <input
              id="edit-discount"
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
          <p className="mt-6 text-sm text-destructive" role="alert">
            {formError}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
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

      <aside className="space-y-3 lg:sticky lg:top-0">
        <div className="rounded-lg border border-sky-200/90 bg-sky-50/90 px-4 py-3 text-sm">
          <p className="font-semibold text-sky-950">活跃项目</p>
          {client.activeProjects && client.activeProjects.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-sky-900/90">
              {client.activeProjects.map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sky-900/70">尚无未归档项目。</p>
          )}
        </div>
        {hasActiveProjects && (
          <div className="rounded-lg border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            该客户下仍有未归档项目时，通常无法将客户归档；请先在「项目」中处理相关项目状态。
          </div>
        )}
      </aside>
    </div>
  )
}

export function ClientEditPage() {
  const { clientId = '' } = useParams()
  const {
    data: ctx,
    isLoading: orgLoading,
    error: ctxError,
  } = useQuery({
    queryKey: ['organization', 'context'],
    queryFn: fetchOrganizationContext,
  })

  const {
    data: client,
    isLoading: clientLoading,
    error: clientError,
  } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => fetchClient(clientId),
    enabled: Boolean(clientId),
  })

  const orgErr =
    ctxError instanceof ApiError
      ? ctxError.status === 401
        ? '登录已过期，请重新登录后再试。'
        : `无法加载组织：${ctxError.message}`
      : ctxError
        ? '无法加载组织信息。'
        : null

  const clientErr =
    clientError instanceof ApiError
      ? clientError.status === 404
        ? '未找到该客户。'
        : clientError.message
      : clientError
        ? '无法加载客户。'
        : null

  if (orgErr) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
        {orgErr}
      </div>
    )
  }

  if (orgLoading || (clientId && clientLoading) || !ctx) {
    return <p className="text-sm text-muted-foreground">加载中…</p>
  }

  if (clientId && !client && !clientErr) {
    return <p className="text-sm text-muted-foreground">加载中…</p>
  }

  if (clientErr || !client) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {clientErr || '未找到该客户。'}
      </p>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-2 h-auto px-0 text-muted-foreground">
          <Link to="/clients">← 返回客户列表</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          编辑客户
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          修改此客户的开票与账期信息。
        </p>
      </div>

      <ClientEditForm
        key={clientId}
        clientId={clientId}
        client={client}
        ctx={ctx as OrganizationContext}
      />
    </div>
  )
}
