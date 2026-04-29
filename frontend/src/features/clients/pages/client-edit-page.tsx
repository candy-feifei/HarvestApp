import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  archiveClient,
  deleteClient,
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
  const [dangerError, setDangerError] = useState<string | null>(null)

  const archiveMut = useMutation({
    mutationFn: () => archiveClient(clientId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clients'] })
      navigate('/clients', { replace: true })
    },
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteClient(clientId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clients'] })
      navigate('/clients', { replace: true })
    },
  })

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

  const hasActiveProjects = (client.activeProjects?.length ?? 0) > 0
  const projectCount = client.projectCount ?? 0
  const canDeleteClient = projectCount === 0
  const busyDanger = archiveMut.isPending || deleteMut.isPending

  function onArchiveClick() {
    setDangerError(null)
    if (!window.confirm('Archive this client? It will be removed from the client list.')) {
      return
    }
    archiveMut.mutate(undefined, {
      onError: (err) => {
        if (err instanceof ApiError) {
          setDangerError(err.message)
          return
        }
        setDangerError('Could not archive. Please try again.')
      },
    })
  }

  function onDeleteClick() {
    setDangerError(null)
    if (
      !window.confirm(
        'Permanently delete this client? This cannot be undone.',
      )
    ) {
      return
    }
    deleteMut.mutate(undefined, {
      onError: (err) => {
        if (err instanceof ApiError) {
          setDangerError(err.message)
          return
        }
        setDangerError('Could not delete. Please try again.')
      },
    })
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px] lg:items-start">
      <div className="min-w-0">
      <form onSubmit={onSubmit} className="min-w-0 space-y-0">
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-[200px_1fr] sm:items-start">
          <label className={labelCls} htmlFor="edit-client-name">
            Client name
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
            Address
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
            Currency
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

        <hr className="my-6 border-border" />

        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-[200px_1fr] sm:items-start">
          <label className={labelCls} htmlFor="edit-invoice-due">
            Invoice payment terms
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
              <option value="UPON_RECEIPT">Due on receipt</option>
              <option value="NET_15">Net 15</option>
              <option value="NET_30">Net 30</option>
              <option value="NET_45">Net 45</option>
              <option value="NET_60">Net 60</option>
              <option value="NET_CUSTOM">Net N (custom days)</option>
            </select>
            {invoiceDueMode === 'NET_DAYS' &&
              invoiceDueSelectValue(invoiceDueMode, invoiceNetDays) ===
                'NET_CUSTOM' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Days</span>
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
            Tax rate
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

          <label className={labelCls} htmlFor="edit-discount">
            Discount
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

      <div className="mt-6 space-y-2 border-t border-border pt-6">
        <p className="text-xs font-medium text-muted-foreground">Danger zone</p>
        {dangerError ? (
          <p className="text-sm text-destructive" role="alert">
            {dangerError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9"
            disabled={hasActiveProjects || busyDanger}
            title={
              hasActiveProjects
                ? 'Archive or close all active projects for this client first'
                : undefined
            }
            onClick={onArchiveClick}
          >
            {archiveMut.isPending ? 'Archiving…' : 'Archive client'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={!canDeleteClient || busyDanger}
            title={
              !canDeleteClient
                ? 'Remove or archive all projects for this client first'
                : undefined
            }
            onClick={onDeleteClick}
          >
            {deleteMut.isPending ? 'Deleting…' : 'Delete client'}
          </Button>
        </div>
      </div>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-0">
        <div className="flex flex-col gap-2">
          <Button className="h-9 w-full" asChild>
            <Link to={`/projects/new?clientId=${clientId}`}>New project</Link>
          </Button>
          <Button variant="outline" className="h-9 w-full border-border" asChild>
            <Link to="/projects">View all projects</Link>
          </Button>
        </div>
        <div className="rounded-lg border border-sky-200/90 bg-sky-50/90 px-4 py-3 text-sm">
          <p className="font-semibold text-sky-950">Active projects</p>
          {client.activeProjects && client.activeProjects.length > 0 ? (
            <ul className="mt-2 space-y-1 list-inside list-disc text-sky-900/90">
              {client.activeProjects.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/projects/${p.id}/edit`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sky-900/70">No active projects yet.</p>
          )}
        </div>
        {hasActiveProjects && (
          <div className="rounded-lg border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            You cannot archive &quot;{client.name}&quot; because it has active
            projects.
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
        ? 'Your session has expired. Please sign in again.'
        : `Could not load organization: ${ctxError.message}`
      : ctxError
        ? 'Could not load organization.'
        : null

  const clientErr =
    clientError instanceof ApiError
      ? clientError.status === 404
        ? 'Client not found.'
        : clientError.message
      : clientError
        ? 'Could not load client.'
        : null

  if (orgErr) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
        {orgErr}
      </div>
    )
  }

  if (orgLoading || (clientId && clientLoading) || !ctx) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (clientId && !client && !clientErr) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (clientErr || !client) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {clientErr || 'Client not found.'}
      </p>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-2 h-auto px-0 text-muted-foreground">
          <Link to="/clients">← Back to clients</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Edit client
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update this client’s invoicing and payment terms.
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
