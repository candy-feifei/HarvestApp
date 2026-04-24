import { useEffect, useMemo, useState } from 'react'
import { Calendar, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  formatDecimalHoursAsClock,
  parseClockToDecimal,
} from '@/features/time/time-format'
import type { AssignableRow, TimeEntryListItem } from '@/features/time/api'

type TrackTimeModalProps = {
  open: boolean
  onClose: () => void
  /** 标题中的日期，长格式由外部传入 */
  dateLabel: string
  ymd: string
  assignable: AssignableRow[]
  editing: TimeEntryListItem | null
  isSubmitting: boolean
  onSave: (payload: {
    projectTaskId: string
    date: string
    hours: number
    notes?: string
  }) => Promise<void>
  /** 仅前端的「开始计时」占位，无后端时不调用 */
  onStartTimerRequest?: (payload: {
    projectTaskId: string
    date: string
    hours: number
    notes?: string
  }) => void
}

export function TrackTimeModal({
  open,
  onClose,
  dateLabel,
  ymd,
  assignable,
  editing,
  isSubmitting,
  onSave,
  onStartTimerRequest,
}: TrackTimeModalProps) {
  const [clientId, setClientId] = useState('')
  const [projectTaskId, setProjectTaskId] = useState('')
  const [timeStr, setTimeStr] = useState('0:00')
  const [notes, setNotes] = useState('')

  const clients = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of assignable) {
      m.set(r.clientId, r.clientName)
    }
    return [...m.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'en'))
  }, [assignable])

  const rowsForClient = useMemo(
    () => assignable.filter((r) => r.clientId === clientId),
    [assignable, clientId],
  )

  useEffect(() => {
    if (!open) return
    if (editing) {
      setClientId(editing.clientId)
      setProjectTaskId(editing.projectTaskId)
      setTimeStr(formatDecimalHoursAsClock(editing.hours))
      setNotes(editing.notes ?? '')
    } else {
      const first = assignable[0]
      setClientId(first?.clientId ?? '')
      setProjectTaskId(first?.projectTaskId ?? '')
      setTimeStr('0:00')
      setNotes('')
    }
  }, [open, editing, assignable])

  useEffect(() => {
    if (!open || editing) return
    const forC = assignable.filter((r) => r.clientId === clientId)
    setProjectTaskId((prev) => {
      if (forC.some((r) => r.projectTaskId === prev)) return prev
      return forC[0]?.projectTaskId ?? ''
    })
  }, [open, clientId, assignable, editing])

  if (!open) {
    return null
  }

  const handleSave = async () => {
    const h = parseClockToDecimal(timeStr)
    if (!clientId || !projectTaskId) {
      return
    }
    await onSave({ projectTaskId, date: ymd, hours: h, notes: notes.trim() || undefined })
  }

  const handleStart = () => {
    if (!onStartTimerRequest) return
    const h = parseClockToDecimal(timeStr)
    if (!clientId || !projectTaskId) return
    onStartTimerRequest({ projectTaskId, date: ymd, hours: h, notes: notes.trim() || undefined })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="track-time-title"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-0 shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="track-time-title" className="text-base font-semibold text-foreground">
            New time entry for {dateLabel}
          </h2>
          <Button type="button" size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="client">
              Client
            </label>
            <select
              id="client"
              className={cn(
                'h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground',
                'shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none',
              )}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={Boolean(editing)}
            >
              {clients.length === 0 ? (
                <option value="">— No clients —</option>
              ) : (
                clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="pt">
              Project / task
            </label>
            <select
              id="pt"
              className={cn(
                'h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground',
                'shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none',
              )}
              value={projectTaskId}
              onChange={(e) => setProjectTaskId(e.target.value)}
              disabled={Boolean(editing)}
            >
              {!clientId || rowsForClient.length === 0 ? (
                <option value="">{!clientId ? '— Select a client first —' : '— No project–task rows —'}</option>
              ) : (
                rowsForClient.map((r) => (
                  <option key={r.projectTaskId} value={r.projectTaskId}>
                    {r.projectName} / {r.taskName}
                  </option>
                ))
              )}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose a client, then the project and task to log time against.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="min-w-0 flex-1">
              <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="notes">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                className="w-full min-h-[100px] rounded-md border border-border bg-white px-2 py-1.5 text-sm text-foreground shadow-sm"
                rows={4}
                placeholder=""
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="flex w-24 shrink-0 flex-col items-center">
              <label
                className="mb-1.5 w-full text-center text-sm font-medium text-foreground"
                htmlFor="time"
              >
                Time
              </label>
              <input
                id="time"
                className="w-full border-0 border-b-2 border-border bg-transparent py-1 text-center text-3xl font-medium tabular-nums tracking-tight text-foreground"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                inputMode="text"
                autoComplete="off"
                placeholder="0:00"
              />
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border/60 pt-2">
            <p className="text-xs text-muted-foreground">Timer and calendar sync come later</p>
            <a
              href="#"
              className="text-xs text-primary"
              onClick={(e) => e.preventDefault()}
            >
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5" />
                Pull in a calendar event
              </span>
            </a>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={handleStart}
            disabled={isSubmitting || !clientId || !projectTaskId}
            title="Timer is not connected yet"
          >
            Start timer
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting || !clientId || !projectTaskId}
            variant="secondary"
          >
            {editing ? 'Save' : 'Log time'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
