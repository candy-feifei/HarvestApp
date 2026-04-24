import { X } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { TeamMemberRow } from '@/features/team/api'
import { cn } from '@/lib/utils'
import { teamMemberLabel, teamRowToFormMember, type ProjectFormTeamMember } from '../types'

const inputCls =
  'w-full min-w-0 rounded-md border border-border bg-white px-2 py-1.5 text-sm text-foreground shadow-sm tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30'

type TeamSectionProps = {
  members: ProjectFormTeamMember[]
  onChange: (next: ProjectFormTeamMember[]) => void
  showRateColumn: boolean
  /** 组织全部成员；下方仅展示未加入本项目的成员（含从上方移除后） */
  memberAddPool: TeamMemberRow[]
  currencySymbol?: string
  catalogLoading?: boolean
}

export function TeamSection({
  members,
  onChange,
  showRateColumn,
  memberAddPool,
  currencySymbol = '$',
  catalogLoading = false,
}: TeamSectionProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [hl, setHl] = useState(0)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const suggestId = useId()

  const inProjectIds = useMemo(
    () => new Set(members.map((m) => m.userId)),
    [members],
  )

  const available = useMemo(() => {
    const q = query.trim().toLowerCase()
    return memberAddPool.filter((m) => {
      if (inProjectIds.has(m.userId)) return false
      if (q === '') return true
      const label = `${teamMemberLabel(m)} ${m.email}`.toLowerCase()
      return label.includes(q)
    })
  }, [memberAddPool, inProjectIds, query])

  useEffect(() => {
    if (!open) return
    setHl(0)
  }, [open, available.length, query])

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, close])

  function pick(row: TeamMemberRow) {
    onChange([...members, teamRowToFormMember(row)])
    setQuery('')
    setOpen(false)
  }

  function remove(userId: string) {
    onChange(members.filter((m) => m.userId !== userId))
  }

  function patch(userId: string, patch: Partial<ProjectFormTeamMember>) {
    onChange(
      members.map((m) => (m.userId === userId ? { ...m, ...patch } : m)),
    )
  }

  function setAllManager(v: boolean) {
    onChange(members.map((m) => ({ ...m, isManager: v })))
  }

  return (
    <div className="rounded-md border border-border bg-white">
      {catalogLoading ? (
        <p className="border-b border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
          正在加载团队成员…
        </p>
      ) : null}
      <div
        className={cn(
          'grid gap-2 border-b border-border/80 bg-muted/10 px-2 py-2 text-xs font-semibold text-muted-foreground sm:px-3',
          showRateColumn
            ? 'sm:grid-cols-[2rem_1fr_7rem_8rem]'
            : 'sm:grid-cols-[2rem_1fr_8rem]',
        )}
      >
        <div />
        <div>Team</div>
        {showRateColumn ? <div className="text-right">Billable rate</div> : null}
        <div className="text-right">
          <span>Manages this project</span>
          <div className="text-[11px] font-normal">
            <button
              type="button"
              onClick={() => setAllManager(true)}
              className="text-primary hover:underline"
            >
              All
            </button>
            {' / '}
            <button
              type="button"
              onClick={() => setAllManager(false)}
              className="text-primary hover:underline"
            >
              None
            </button>
          </div>
        </div>
      </div>
      <ul>
        {members.map((m) => (
          <li
            key={m.userId}
            className={cn(
              'grid grid-cols-1 items-center gap-2 border-b border-border/60 px-2 py-2.5 sm:px-3',
              showRateColumn
                ? 'sm:grid-cols-[2rem_1fr_7rem_8rem]'
                : 'sm:grid-cols-[2rem_1fr_8rem]',
            )}
          >
            <button
              type="button"
              onClick={() => remove(m.userId)}
              className="inline-flex size-7 items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted/40"
              title="从本项目移除"
            >
              <X className="size-3.5" />
            </button>
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted/30 text-xs font-semibold text-foreground"
                aria-hidden
              >
                {m.name
                  .split(/\s+/)
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span className="min-w-0 truncate text-sm font-medium text-foreground">
                {m.name}
              </span>
            </div>
            {showRateColumn ? (
              <div className="flex items-center justify-end gap-0.5">
                <span className="text-sm text-muted-foreground">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={cn(inputCls, 'max-w-[6.5rem]')}
                  value={m.billableRate}
                  onChange={(e) =>
                    patch(m.userId, {
                      billableRate: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
            ) : null}
            <div className="flex justify-end">
              <input
                type="checkbox"
                className="size-4 rounded border-border text-primary"
                checked={m.isManager}
                onChange={(e) => patch(m.userId, { isManager: e.target.checked })}
              />
            </div>
          </li>
        ))}
      </ul>
      <div ref={wrapRef} className="relative space-y-1 border-t border-border/60 p-2.5 sm:p-3">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onClick={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (available.length) {
                setHl((h) => Math.min(h + 1, available.length - 1))
                setOpen(true)
              }
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHl((h) => Math.max(0, h - 1))
            } else if (e.key === 'Enter' && open && available.length) {
              e.preventDefault()
              const row = available[hl] ?? available[0]
              if (row) pick(row)
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          placeholder="Assign a person…"
          className="h-9 w-full min-w-0 rounded-md border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          autoComplete="off"
          aria-label="搜索并添加未加入本项目的成员"
          aria-expanded={open}
          aria-controls={suggestId}
        />
        {open && available.length > 0 ? (
          <div
            id={suggestId}
            className="absolute z-[100] mt-0.5 max-h-48 w-full min-w-0 overflow-y-auto rounded-md border border-border bg-white py-0.5 shadow-lg"
            role="listbox"
          >
            {available.map((row, i) => (
              <button
                key={row.userId}
                type="button"
                role="option"
                aria-selected={i === hl}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm',
                  i === hl
                    ? 'bg-foreground text-background'
                    : 'text-foreground hover:bg-muted/50',
                )}
                onMouseEnter={() => setHl(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(row)
                }}
              >
                {teamMemberLabel(row)}
                <span className="ms-1 text-xs opacity-80">({row.email})</span>
              </button>
            ))}
          </div>
        ) : null}
        {open && !catalogLoading && query.trim() !== '' && available.length === 0 ? (
          <p className="absolute z-[100] mt-0.5 w-full rounded-md border border-dashed border-border bg-muted/20 px-2 py-2 text-xs text-muted-foreground">
            没有匹配的成员
          </p>
        ) : null}
        {open &&
        !catalogLoading &&
        query.trim() === '' &&
        memberAddPool.filter((m) => !inProjectIds.has(m.userId)).length ===
          0 ? (
          <p className="absolute z-[100] mt-0.5 w-full rounded-md border border-border bg-white px-2 py-2 text-xs text-muted-foreground shadow-lg">
            全部成员已加入本项目
          </p>
        ) : null}
      </div>
    </div>
  )
}
