import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/http'
import { cn } from '@/lib/utils'
import {
  createExpenseCategory,
  deleteExpenseCategory,
  listExpenseCategories,
  updateExpenseCategory,
  type ExpenseCategoryItem,
} from '@/features/expenses/api'

const inputClass = cn(
  'w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-xs outline-none',
  'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30',
)

type CategoryManagerProps = {
  /** Controlled from the page header (New category / Close). */
  creating: boolean
  onCreatingChange: (open: boolean) => void
}

export function CategoryManager({ creating, onCreatingChange }: CategoryManagerProps) {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => listExpenseCategories(),
  })
  const [name, setName] = useState('')
  const [hasUnit, setHasUnit] = useState(false)
  const [unitName, setUnitName] = useState('mile')
  const [unitPrice, setUnitPrice] = useState('')

  const createMut = useMutation({
    mutationFn: () =>
      createExpenseCategory({
        name: name.trim(),
        hasUnitPrice: hasUnit,
        unitName: hasUnit ? unitName.trim() : undefined,
        unitPrice: hasUnit ? parseFloat(unitPrice) : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expense-categories'] })
      void queryClient.invalidateQueries({ queryKey: ['expense-form-options'] })
      onCreatingChange(false)
      setName('')
      setHasUnit(false)
      setUnitName('mile')
      setUnitPrice('')
    },
  })

  const err =
    error instanceof ApiError
      ? error.message
      : error
        ? 'Failed to load'
        : null
  const createErr =
    createMut.error instanceof ApiError
      ? createMut.error.message
      : createMut.error
        ? 'Failed to create'
        : null

  const items = data?.items ?? []

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Manage organization-wide expense categories. For unit-priced categories
        (e.g. mileage), set the unit and default rate below; the track form will
        compute amount from quantity.
      </p>

      {creating ? (
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 p-4">
          <h3 className="text-sm font-semibold text-foreground">New category</h3>
          <div className="mt-3 space-y-2">
            <label className="block text-sm">
              <span>Name</span>
              <input
                className={cn('mt-1', inputClass)}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Transportation"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasUnit}
                onChange={(e) => setHasUnit(e.target.checked)}
              />
              This category is priced per unit (e.g. per mile or km)
            </label>
            {hasUnit ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-sm">
                  <span>Unit</span>
                  <input
                    className={cn('mt-1', inputClass)}
                    value={unitName}
                    onChange={(e) => setUnitName(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span>Default rate</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={cn('mt-1', inputClass)}
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                  />
                </label>
              </div>
            ) : null}
          </div>
          {createErr ? (
            <p className="mt-2 text-sm text-destructive">{createErr}</p>
          ) : null}
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onCreatingChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!name.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              Save
            </Button>
          </div>
        </div>
      ) : null}

      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="space-y-1">
          {items.map((c) => (
            <CategoryRow
              key={c.id}
              item={c}
              onChanged={() => {
                void queryClient.invalidateQueries({
                  queryKey: ['expense-categories'],
                })
                void queryClient.invalidateQueries({
                  queryKey: ['expense-form-options'],
                })
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function CategoryRow({
  item,
  onChanged,
}: {
  item: ExpenseCategoryItem
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [hasUnit, setHasUnit] = useState(item.hasUnitPrice)
  const [unitName, setUnitName] = useState(item.unitName ?? 'mile')
  const [unitPrice, setUnitPrice] = useState(item.unitPrice ?? '0')

  const patchMut = useMutation({
    mutationFn: (body: Parameters<typeof updateExpenseCategory>[1]) =>
      updateExpenseCategory(item.id, body),
    onSuccess: () => {
      onChanged()
      setEditing(false)
    },
  })

  const delMut = useMutation({
    mutationFn: () => deleteExpenseCategory(item.id),
    onSuccess: onChanged,
  })

  const display =
    item.hasUnitPrice && item.unitName && item.unitPrice
      ? `${item.name} ($${item.unitPrice} / ${item.unitName})`
      : item.name

  if (editing) {
    return (
      <li className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-white p-3">
        <label className="min-w-[120px] flex-1 text-sm">
          Name
          <input
            className={cn('mt-1', inputClass)}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasUnit}
            onChange={(e) => setHasUnit(e.target.checked)}
          />
          Per-unit
        </label>
        {hasUnit ? (
          <>
            <input
              className={cn('h-9 w-24', inputClass)}
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
            />
            <input
              type="number"
              className={cn('h-9 w-28', inputClass)}
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          </>
        ) : null}
        <div className="ml-auto flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() =>
              patchMut.mutate({
                name: name.trim(),
                hasUnitPrice: hasUnit,
                unitName: hasUnit ? unitName : null,
                unitPrice: hasUnit ? parseFloat(unitPrice) : null,
              })
            }
            disabled={patchMut.isPending}
          >
            Save
          </Button>
        </div>
      </li>
    )
  }

  return (
    <li className="flex min-h-[48px] flex-wrap items-center gap-2 rounded-md border border-border bg-white px-3 py-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setName(item.name)
          setHasUnit(item.hasUnitPrice)
          setUnitName(item.unitName ?? 'mile')
          setUnitPrice(item.unitPrice ?? '0')
          setEditing(true)
        }}
      >
        Edit
      </Button>
      <span className="text-sm font-medium text-foreground">{display}</span>
      {item.isArchived ? (
        <span className="text-xs text-muted-foreground">Archived</span>
      ) : null}
      <div className="ml-auto flex gap-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => patchMut.mutate({ isArchived: !item.isArchived })}
          disabled={patchMut.isPending}
        >
          {item.isArchived ? 'Restore' : 'Archive'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={() => {
            if (
              window.confirm(
                'Delete this category? You cannot delete it if expenses still reference it.',
              )
            ) {
              void delMut.mutate()
            }
          }}
          disabled={delMut.isPending}
        >
          Delete
        </Button>
      </div>
    </li>
  )
}
