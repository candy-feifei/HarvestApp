import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TimeEntryListItem } from '@/features/time/api'

/** One day in the row-notes dialog (positive hours only). */
type RowDaySlice = {
  date: string
  dateLabel: string
  entry: TimeEntryListItem
}

type WeekRowNotesDialogProps = {
  open: boolean
  onClose: () => void
  projectLabel: string
  taskLabel: string
  /** Days on which hours were logged (positive). */
  days: RowDaySlice[]
  isSaving: boolean
  onSave: (updates: { id: string; notes: string }[]) => void | Promise<void>
}

export function WeekRowNotesDialog({
  open,
  onClose,
  projectLabel,
  taskLabel,
  days,
  isSaving,
  onSave,
}: WeekRowNotesDialogProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) {
      return
    }
    const m: Record<string, string> = {}
    for (const d of days) {
      m[d.entry.id] = d.entry.notes ?? ''
    }
    setDrafts(m)
  }, [open, days])

  if (!open) {
    return null
  }

  const handleSave = async () => {
    const updates: { id: string; notes: string }[] = []
    for (const d of days) {
      const next = drafts[d.entry.id] ?? ''
      const prev = d.entry.notes ?? ''
      if (next !== prev) {
        updates.push({ id: d.entry.id, notes: next })
      }
    }
    if (updates.length === 0) {
      onClose()
      return
    }
    await onSave(updates)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="week-row-notes-title"
    >
      <div className="max-h-[min(90vh,32rem)] w-full max-w-md overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 id="week-row-notes-title" className="text-base font-semibold text-foreground">
              Row notes
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {projectLabel} · {taskLabel}
            </p>
          </div>
          <Button type="button" size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="max-h-[min(60vh,24rem)] space-y-4 overflow-y-auto p-4">
          {days.length === 0 ? (
            <p className="text-sm text-muted-foreground">No days with time logged yet. Enter hours first.</p>
          ) : (
            days.map((d) => {
              const locked = d.entry.isLocked
              return (
                <div key={d.entry.id}>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor={`wn-${d.entry.id}`}>
                    {d.dateLabel}
                    {locked ? ' (locked)' : ''}
                  </label>
                  <textarea
                    id={`wn-${d.entry.id}`}
                    rows={2}
                    disabled={locked}
                    className={cn(
                      'w-full resize-y rounded-md border border-border bg-white px-2 py-1.5 text-sm',
                      'focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none',
                      locked && 'cursor-not-allowed opacity-60',
                    )}
                    value={drafts[d.entry.id] ?? ''}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [d.entry.id]: e.target.value }))}
                    placeholder="Note for this day…"
                  />
                </div>
              )
            })
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => void handleSave()}
            disabled={isSaving || days.length === 0}
          >
            Save notes
          </Button>
        </div>
      </div>
    </div>
  )
}

type WeekCellNoteDialogProps = {
  open: boolean
  onClose: () => void
  dateLabel: string
  entry: TimeEntryListItem | null
  isSaving: boolean
  onSave: (entryId: string, notes: string) => void | Promise<void>
}

type WeekDayColumnNotesDialogProps = {
  open: boolean
  onClose: () => void
  dateLabel: string
  /** 该日所有 time entry；按日汇总编辑备注 */
  entries: TimeEntryListItem[]
  isSaving: boolean
  onSave: (updates: { id: string; notes: string }[]) => void | Promise<void>
}

export function WeekDayColumnNotesDialog({
  open,
  onClose,
  dateLabel,
  entries,
  isSaving,
  onSave,
}: WeekDayColumnNotesDialogProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) {
      return
    }
    const m: Record<string, string> = {}
    for (const e of entries) {
      m[e.id] = e.notes ?? ''
    }
    setDrafts(m)
  }, [open, entries])

  if (!open) {
    return null
  }

  const handleSave = async () => {
    const updates: { id: string; notes: string }[] = []
    for (const e of entries) {
      const next = drafts[e.id] ?? ''
      const prev = e.notes ?? ''
      if (next !== prev) {
        updates.push({ id: e.id, notes: next })
      }
    }
    if (updates.length === 0) {
      onClose()
      return
    }
    await onSave(updates)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="week-day-col-notes-title"
    >
      <div className="max-h-[min(90vh,32rem)] w-full max-w-md overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 id="week-day-col-notes-title" className="text-base font-semibold text-foreground">
              Day notes
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{dateLabel}</p>
          </div>
          <Button type="button" size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="max-h-[min(60vh,24rem)] space-y-4 overflow-y-auto p-4">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Log time for this day before adding notes.
            </p>
          ) : (
            entries.map((e) => {
              const locked = e.isLocked
              const label = [e.clientName, e.projectName, e.taskName].filter(Boolean).join(' · ')
              return (
                <div key={e.id}>
                  <label
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                    htmlFor={`wdn-col-${e.id}`}
                  >
                    {label}
                    {locked ? ' (locked)' : ''}
                  </label>
                  <textarea
                    id={`wdn-col-${e.id}`}
                    rows={2}
                    disabled={locked}
                    className={cn(
                      'w-full resize-y rounded-md border border-border bg-white px-2 py-1.5 text-sm',
                      'focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none',
                      locked && 'cursor-not-allowed opacity-60',
                    )}
                    value={drafts[e.id] ?? ''}
                    onChange={(ev) => setDrafts((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                    placeholder="Note for this line…"
                  />
                </div>
              )
            })
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => void handleSave()}
            disabled={isSaving || entries.length === 0}
          >
            Save notes
          </Button>
        </div>
      </div>
    </div>
  )
}

export function WeekCellNoteDialog({
  open,
  onClose,
  dateLabel,
  entry,
  isSaving,
  onSave,
}: WeekCellNoteDialogProps) {
  const [text, setText] = useState('')

  useEffect(() => {
    if (open) {
      setText(entry?.notes ?? '')
    }
  }, [open, entry])

  if (!open) {
    return null
  }

  const locked = entry?.isLocked

  const handleSave = async () => {
    if (!entry) {
      onClose()
      return
    }
    if (locked) {
      onClose()
      return
    }
    const next = text
    if (next === (entry.notes ?? '')) {
      onClose()
      return
    }
    await onSave(entry.id, next)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="week-cell-note-title"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="week-cell-note-title" className="text-base font-semibold text-foreground">
            Note · {dateLabel}
          </h2>
          <Button type="button" size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="p-4">
          {!entry ? (
            <p className="text-sm text-muted-foreground">Log time for this day before adding a note.</p>
          ) : (
            <textarea
              rows={4}
              disabled={Boolean(locked)}
              className={cn(
                'w-full resize-y rounded-md border border-border bg-white px-2 py-1.5 text-sm',
                'focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none',
                locked && 'cursor-not-allowed opacity-60',
              )}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Note for this day…"
            />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => void handleSave()}
            disabled={isSaving || !entry || locked}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
