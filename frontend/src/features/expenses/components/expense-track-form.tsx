import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/http'
import { cn } from '@/lib/utils'
import {
  createExpense,
  fetchExpenseFormOptions,
  type CreateExpenseRequest,
  uploadExpenseReceipt,
} from '@/features/expenses/api'

const inputClass = cn(
  'w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-xs outline-none',
  'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30',
  'disabled:cursor-not-allowed disabled:opacity-50',
)

type ExpenseTrackFormProps = {
  open: boolean
  onClose: () => void
}

function todayIso() {
  const d = new Date()
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function ExpenseTrackForm({ open, onClose }: ExpenseTrackFormProps) {
  const queryClient = useQueryClient()
  const { data: options } = useQuery({
    queryKey: ['expense-form-options'],
    queryFn: fetchExpenseFormOptions,
    enabled: open,
  })

  const [spentDate, setSpentDate] = useState(todayIso)
  const [projectId, setProjectId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [receiptName, setReceiptName] = useState<string | null>(null)
  const [receiptUploading, setReceiptUploading] = useState(false)
  const [receiptUploadError, setReceiptUploadError] = useState<string | null>(
    null,
  )
  const [isBillable, setIsBillable] = useState(true)
  const [isReimbursable, setIsReimbursable] = useState(false)
  const [unitQty, setUnitQty] = useState('')

  const currency = options?.defaultCurrency ?? 'USD'
  const category = useMemo(
    () => options?.categories.find((c) => c.id === categoryId),
    [options, categoryId],
  )
  const hasUnit =
    category?.unitName != null &&
    category?.unitName !== '' &&
    category?.unitPrice != null

  const firstProject = options?.projects[0]
  const firstCategory = options?.categories[0]
  useEffect(() => {
    if (!open) return
    if (!options) return
    setSpentDate(todayIso)
    if (firstProject) setProjectId(firstProject.id)
    if (firstCategory) setCategoryId(firstCategory.id)
    setAmount('')
    setUnitQty('')
    setNotes('')
    setReceiptUrl('')
    setReceiptName(null)
    setReceiptUploadError(null)
    setIsBillable(true)
    setIsReimbursable(false)
  }, [open, options, firstProject?.id, firstCategory?.id])

  // Unit-priced categories: quantity × unit price
  useEffect(() => {
    if (!hasUnit || !category?.unitPrice) return
    const u = parseFloat(unitQty)
    if (Number.isNaN(u) || u < 0) {
      setAmount('')
      return
    }
    const p = parseFloat(category.unitPrice)
    setAmount((u * p).toFixed(2))
  }, [unitQty, hasUnit, category?.unitPrice])

  const mutation = useMutation({
    mutationFn: (body: CreateExpenseRequest) => createExpense(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
      void queryClient.invalidateQueries({ queryKey: ['expense-form-options'] })
      onClose()
    },
  })

  if (!open) {
    return null
  }

  const err =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? 'Could not save'
        : null

  function submit() {
    const a = parseFloat(amount)
    if (Number.isNaN(a) || a < 0) {
      return
    }
    mutation.mutate({
      spentDate: new Date(spentDate).toISOString(),
      amount: a,
      notes: notes.trim() || undefined,
      receiptUrl: receiptUrl.trim() || undefined,
      isBillable,
      isReimbursable,
      projectId,
      categoryId,
      unitQuantity: hasUnit && unitQty
        ? parseFloat(unitQty)
        : undefined,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      role="dialog"
      aria-modal
      aria-labelledby="expense-form-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg">
        <h2
          id="expense-form-title"
          className="text-lg font-semibold text-foreground"
        >
          Track expense
        </h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-muted-foreground">Date</span>
            <input
              type="date"
              className={cn('mt-1', inputClass)}
              value={spentDate}
              onChange={(e) => setSpentDate(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Project</span>
            <select
              className={cn('mt-1', inputClass)}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {options?.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.clientName})
                </option>
              )) ?? <option value="">Loading…</option>}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Category</span>
            <select
              className={cn('mt-1', inputClass)}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {options?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.unitName
                    ? ` (${currency} ${c.unitPrice} / ${c.unitName})`
                    : ''}
                </option>
              )) ?? <option value="">Loading…</option>}
            </select>
          </label>
          {hasUnit ? (
            <label className="block text-sm">
              <span className="text-muted-foreground">
                Quantity ({category?.unitName})
              </span>
              <input
                type="number"
                min={0}
                step="any"
                className={cn('mt-1', inputClass)}
                value={unitQty}
                onChange={(e) => setUnitQty(e.target.value)}
                placeholder="e.g. miles driven"
              />
            </label>
          ) : null}
          <label className="block text-sm">
            <span className="text-muted-foreground">Amount ({currency})</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className={cn('mt-1', inputClass)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              readOnly={hasUnit}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Notes</span>
            <textarea
              className={cn('mt-1 min-h-[72px] resize-y', inputClass)}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="block text-sm">
            <span className="text-muted-foreground">
              Receipt (optional — upload or paste a link)
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
              className={cn('mt-1 block w-full text-sm', inputClass)}
              onChange={async (e) => {
                setReceiptUploadError(null)
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                setReceiptUploading(true)
                setReceiptName(f.name)
                try {
                  const { receiptUrl: url } = await uploadExpenseReceipt(f)
                  setReceiptUrl(url)
                } catch (ex) {
                  setReceiptName(null)
                  setReceiptUrl('')
                  setReceiptUploadError(
                    ex instanceof ApiError
                      ? ex.message
                      : ex instanceof Error
                        ? ex.message
                        : 'Upload failed',
                  )
                } finally {
                  setReceiptUploading(false)
                }
              }}
            />
            {receiptUrl ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {receiptName ? `Selected: ${receiptName} · ` : null}
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  View / download
                </a>
                {' · '}
                <button
                  type="button"
                  className="text-destructive underline"
                  onClick={() => {
                    setReceiptUrl('')
                    setReceiptName(null)
                    setReceiptUploadError(null)
                  }}
                >
                  Clear
                </button>
              </p>
            ) : null}
            {receiptUploading ? (
              <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>
            ) : null}
            {receiptUploadError ? (
              <p className="mt-1 text-xs text-destructive">
                {receiptUploadError}
              </p>
            ) : null}
            <input
              type="url"
              className={cn('mt-2', inputClass)}
              value={receiptUrl}
              onChange={(e) => {
                setReceiptName(null)
                setReceiptUrl(e.target.value)
              }}
              placeholder="Or paste a link to the receipt"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isBillable}
              onChange={(e) => setIsBillable(e.target.checked)}
            />
            Billable (can appear on client invoices)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isReimbursable}
              onChange={(e) => setIsReimbursable(e.target.checked)}
            />
            Reimbursable to the employee
          </label>
        </div>
        {err ? <p className="mt-3 text-sm text-destructive">{err}</p> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={mutation.isPending}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
