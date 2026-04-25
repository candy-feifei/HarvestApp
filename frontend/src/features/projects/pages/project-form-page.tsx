import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { fetchOrganizationContext } from '@/features/clients/api'
import { listClients } from '@/features/clients/api'
import { listTeamMembers } from '@/features/team/api'
import { listTasks, type TaskListItem } from '@/features/tasks/api'
import { ApiError } from '@/lib/api/http'
import { cn } from '@/lib/utils'
import {
  createProject,
  formValuesToCreatePayload,
  formValuesToUpdatePayload,
  getProject,
  updateProject,
} from '../api'
import { TaskSection } from '../components/task-section'
import { TeamSection } from '../components/team-section'
import {
  defaultProjectFormValues,
  projectFormValuesFromRecord,
  projectTeamForEditFromSaved,
  projectTeamInitialForNewUser,
  projectTasksForEditFromSaved,
  projectTasksFromCommonItems,
  type ProjectFormValues,
} from '../types'

const inputCls =
  'w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30'
const labelCls = 'w-40 shrink-0 text-sm font-medium text-foreground sm:w-48'
const helpCls = 'text-xs text-muted-foreground'
const cardTabBase =
  'flex flex-1 flex-col items-start rounded-md border px-3 py-3 text-left text-sm transition'
const projectTypeCard = (active: boolean) =>
  cn(
    cardTabBase,
    active
      ? 'border-primary bg-primary/[0.06] ring-1 ring-primary/25'
      : 'border-border bg-white hover:bg-muted/20',
  )

export function ProjectFormPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const isEdit = Boolean(projectId)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [form, setForm] = useState<ProjectFormValues>(() => defaultProjectFormValues())
  const [err, setErr] = useState<string | null>(null)

  const orgQuery = useQuery({
    queryKey: ['organization', 'context'],
    queryFn: fetchOrganizationContext,
  })

  const clientsQuery = useQuery({
    queryKey: ['clients', 'for-projects'],
    queryFn: () => listClients(''),
  })

  const teamQuery = useQuery({
    queryKey: ['team', 'members'],
    queryFn: listTeamMembers,
  })

  const projectQuery = useQuery({
    queryKey: ['projects', 'one', projectId],
    queryFn: () => getProject(projectId!),
    enabled: isEdit,
  })

  const tasksCatalogQuery = useQuery({
    queryKey: ['tasks', 'catalog', 'project-form'],
    queryFn: () => listTasks(),
    staleTime: 60_000,
  })

  const newProjectTasksSeeded = useRef(false)
  useEffect(() => {
    if (isEdit) {
      newProjectTasksSeeded.current = false
      return
    }
    if (!tasksCatalogQuery.data) return
    if (newProjectTasksSeeded.current) return
    newProjectTasksSeeded.current = true
    setForm((f) => ({
      ...f,
      tasks: projectTasksFromCommonItems(tasksCatalogQuery.data.common),
    }))
  }, [isEdit, tasksCatalogQuery.data])

  const newProjectTeamSeeded = useRef(false)
  useEffect(() => {
    if (isEdit) {
      newProjectTeamSeeded.current = false
      return
    }
    if (!orgQuery.data || !teamQuery.data?.items?.length) return
    if (newProjectTeamSeeded.current) return
    const initial = projectTeamInitialForNewUser(
      orgQuery.data,
      teamQuery.data.items,
    )
    if (initial.length === 0) return
    newProjectTeamSeeded.current = true
    setForm((f) => ({ ...f, team: initial }))
  }, [isEdit, orgQuery.data, teamQuery.data])

  useEffect(() => {
    if (!isEdit) return
    if (!projectQuery.data) return
    const base = projectFormValuesFromRecord(projectQuery.data)
    const next: ProjectFormValues = { ...base }
    if (teamQuery.data?.items) {
      const teamSaved =
        projectQuery.data.team?.length
          ? projectQuery.data.team
          : projectQuery.data.metadata?.team
      next.team = projectTeamForEditFromSaved(
        teamSaved,
        teamQuery.data.items,
      )
    }
    if (tasksCatalogQuery.data) {
      const taskSaved =
        projectQuery.data.tasks?.length
          ? projectQuery.data.tasks
          : projectQuery.data.metadata?.tasks
      next.tasks = projectTasksForEditFromSaved(
        taskSaved,
        tasksCatalogQuery.data.common,
        tasksCatalogQuery.data.other,
      )
    }
    setForm(next)
  }, [isEdit, projectQuery.data, teamQuery.data, tasksCatalogQuery.data])

  const currency = orgQuery.data?.organization.defaultCurrency ?? 'USD'
  const currencySymbol = new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
  })
    .formatToParts(0)
    .find((p) => p.type === 'currency')?.value ?? '$'

  const createMut = useMutation({
    mutationFn: () => createProject(formValuesToCreatePayload(form)),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['projects'] })
      navigate('/projects')
    },
  })

  const updateMut = useMutation({
    mutationFn: () => {
      if (!projectQuery.data) throw new Error('Missing project')
      return updateProject(
        projectId!,
        formValuesToUpdatePayload(form, projectQuery.data),
      )
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['projects'] })
      if (projectId) {
        await qc.invalidateQueries({ queryKey: ['projects', 'one', projectId] })
      }
      navigate('/projects')
    },
  })

  const busy = createMut.isPending || updateMut.isPending

  function set<K extends keyof ProjectFormValues>(key: K, v: ProjectFormValues[K]) {
    setForm((f) => ({ ...f, [key]: v }))
  }

  const showTaskRates =
    form.projectType === 'time_materials' && form.billableRateMode === 'task_rate'
  const showMemberRates =
    form.projectType === 'time_materials' && form.billableRateMode === 'person_rate'
  const showProjectRateInput =
    form.projectType === 'time_materials' && form.billableRateMode === 'project_rate'
  const showInfoPerson =
    form.projectType === 'time_materials' && form.billableRateMode === 'person_rate'
  const showInfoTask =
    form.projectType === 'time_materials' && form.billableRateMode === 'task_rate'

  const clientOptions = clientsQuery.data?.items ?? []
  const teamRows = teamQuery.data?.items ?? []

  /** Union of common & other tasks for the add-task combobox (includes tasks not yet on this project). */
  const taskAddPool = useMemo((): TaskListItem[] => {
    const d = tasksCatalogQuery.data
    if (!d) return []
    const byId = new Map<string, TaskListItem>()
    for (const t of d.common) byId.set(t.id, t)
    for (const t of d.other) byId.set(t.id, t)
    return Array.from(byId.values())
  }, [tasksCatalogQuery.data])

  async function onSave() {
    setErr(null)
    if (!form.clientId) {
      setErr('Please select a client.')
      return
    }
    if (!form.name.trim()) {
      setErr('Please enter a project name.')
      return
    }
    try {
      if (isEdit) {
        await updateMut.mutateAsync()
      } else {
        await createMut.mutateAsync()
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setErr(e.message)
        return
      }
      setErr('Could not save. Please try again.')
    }
  }

  if (isEdit && projectQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Loading project…</p>
      </div>
    )
  }
  if (isEdit && projectQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-destructive" role="alert">
          Could not load the project.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/projects">Back to list</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {isEdit ? 'Edit project' : 'New project'}
        </h1>
      </div>

      {err ? (
        <p className="text-sm text-destructive" role="alert">
          {err}
        </p>
      ) : null}

      <section className="space-y-4">
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <span className={labelCls}>Client</span>
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              <select
                value={form.clientId}
                onChange={(e) => set('clientId', e.target.value)}
                className={cn(inputCls, 'max-w-md flex-1')}
              >
                <option value="">Choose a client…</option>
                {clientOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button asChild type="button" variant="outline" size="sm" className="h-9">
                <Link to="/clients/new">+ New client</Link>
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start">
            <span className={labelCls}>Project name</span>
            <div className="min-w-0 flex-1">
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className={inputCls}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start">
            <span className={labelCls}>Project code</span>
            <div className="min-w-0 flex-1">
              <input
                value={form.projectCode}
                onChange={(e) => set('projectCode', e.target.value)}
                className={inputCls}
                autoComplete="off"
              />
              <p className={cn(helpCls, 'mt-1.5')}>
                Optional. A code can help identify your project. You can use any
                combination of numbers or letters.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start">
            <span className={labelCls}>Dates</span>
            <div className="flex min-w-0 flex-1 flex-wrap gap-3">
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs text-muted-foreground">Starts on</span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs text-muted-foreground">Ends on</span>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => set('endDate', e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>
          </div>
          <p className={cn(helpCls, 'sm:ps-[12.5rem]')}>
            Optional. You will still be able to track time outside of this
            range.
          </p>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start">
            <span className={labelCls}>Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              className={cn(inputCls, 'min-h-24 resize-y')}
              rows={4}
            />
          </div>
          <p className={cn(helpCls, 'sm:ps-[12.5rem]')}>
            Optional. Notes are great for anything you need to reference
            later…
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <span className={labelCls}>Permissions</span>
            <div className="min-w-0 flex-1 space-y-2">
              <label className="flex cursor-pointer gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  className="mt-0.5 size-4 border-border text-primary"
                  checked={form.reportPermission === 'admin'}
                  onChange={() => set('reportPermission', 'admin')}
                />
                Show project report to Administrators and people who manage
                this project
              </label>
              <label className="flex cursor-pointer gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  className="mt-0.5 size-4 border-border text-primary"
                  checked={form.reportPermission === 'everyone'}
                  onChange={() => set('reportPermission', 'everyone')}
                />
                Show project report to everyone on this project
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
      <h2 className="mb-2 text-sm font-semibold text-foreground">
        Project type
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className={projectTypeCard(form.projectType === 'time_materials')}
            onClick={() => set('projectType', 'time_materials')}
          >
            <span className="font-semibold text-foreground">Time & Materials</span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              Bill by the hour, with billable rates
            </span>
          </button>
          <button
            type="button"
            className={projectTypeCard(form.projectType === 'fixed_fee')}
            onClick={() => set('projectType', 'fixed_fee')}
          >
            <span className="font-semibold text-foreground">Fixed Fee</span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              Bill a set price, regardless of time tracked
            </span>
          </button>
          <button
            type="button"
            className={projectTypeCard(form.projectType === 'non_billable')}
            onClick={() => set('projectType', 'non_billable')}
          >
            <span className="font-semibold text-foreground">Non-Billable</span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              Not billed to a client
            </span>
          </button>
        </div>

        {form.projectType === 'time_materials' && (
          <div className="mt-3 space-y-3 rounded-md border border-border/80 bg-muted/10 p-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Billable rates</p>
              <p className={helpCls}>
                We need billable rates to track your project&apos;s billable
                amount.
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={form.billableRateMode}
                  onChange={(e) =>
                    set(
                      'billableRateMode',
                      e.target.value as ProjectFormValues['billableRateMode'],
                    )
                  }
                  className={cn(inputCls, 'max-w-xs')}
                >
                  <option value="no_rate">No billable rate</option>
                  <option value="project_rate">Project billable rate</option>
                  <option value="person_rate">Person billable rate</option>
                  <option value="task_rate">Task billable rate</option>
                </select>
                {showProjectRateInput && (
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={cn(inputCls, 'w-28 tabular-nums')}
                      value={form.projectHourlyRate}
                      onChange={(e) =>
                        set('projectHourlyRate', Number(e.target.value) || 0)
                      }
                    />
                    <span className="text-sm text-muted-foreground">per hour</span>
                  </div>
                )}
                {showInfoPerson && (
                  <div
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-2 py-1.5 text-xs text-sky-900"
                    role="status"
                  >
                    <span
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-sky-400 text-[10px] font-bold"
                      aria-hidden
                    >
                      i
                    </span>
                    You can set your rates in the Team section below.
                  </div>
                )}
                {showInfoTask && (
                  <div
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-2 py-1.5 text-xs text-sky-900"
                    role="status"
                  >
                    <span
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-sky-400 text-[10px] font-bold"
                      aria-hidden
                    >
                      i
                    </span>
                    You can set your rates in the Tasks section below.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {form.projectType === 'fixed_fee' && (
          <div className="mt-2 space-y-3 rounded-md border border-border/80 bg-muted/10 p-3">
            <div className="grid gap-1.5 sm:grid-cols-[auto_1fr] sm:items-end">
              <div>
                <p className="text-sm font-semibold text-foreground">Project fees</p>
                <p className={helpCls}>
                  Enter the amount you plan to invoice.
                </p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={cn(inputCls, 'max-w-[10rem] tabular-nums')}
                  value={form.projectFees}
                  onChange={(e) =>
                    set('projectFees', Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>
          </div>
        )}

        {form.projectType === 'non_billable' && (
          <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            This type is not billed to a client. Billable and fee fields do not
            apply.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Tasks</h2>
        <TaskSection
          tasks={form.tasks}
          onChange={(tasks) => set('tasks', tasks)}
          showRateColumn={showTaskRates}
          currencySymbol={currencySymbol}
          taskAddPool={taskAddPool}
          catalogLoading={tasksCatalogQuery.isLoading}
        />
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Team</h2>
        {teamQuery.isError ? (
          <p className="text-sm text-destructive">Could not load the team list.</p>
        ) : (
          <TeamSection
            members={form.team}
            onChange={(team) => {
              set('team', team)
            }}
            showRateColumn={showMemberRates}
            memberAddPool={teamRows}
            catalogLoading={teamQuery.isLoading}
            currencySymbol={currencySymbol}
          />
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Invoice values</h2>
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <span className={labelCls}>Invoice due date</span>
            <select
              value={form.invoice.dueMode}
              onChange={(e) =>
                set('invoice', {
                  ...form.invoice,
                  dueMode: e.target.value as ProjectFormValues['invoice']['dueMode'],
                })
              }
              className={cn(inputCls, 'max-w-md')}
            >
              <option value="upon_receipt">Upon receipt</option>
              <option value="net_15">Net 15</option>
              <option value="net_30">Net 30</option>
              <option value="net_45">Net 45</option>
              <option value="net_60">Net 60</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <span className={labelCls}>PO Number</span>
            <input
              value={form.invoice.poNumber}
              onChange={(e) =>
                set('invoice', { ...form.invoice, poNumber: e.target.value })
              }
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <span className={labelCls}>Tax</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                className={cn(inputCls, 'w-20 tabular-nums')}
                value={form.invoice.taxPercent}
                onChange={(e) =>
                  set('invoice', {
                    ...form.invoice,
                    taxPercent: Number(e.target.value) || 0,
                  })
                }
              />
              <span className="text-sm text-muted-foreground">%</span>
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() =>
                  set('invoice', {
                    ...form.invoice,
                    secondTaxEnabled: !form.invoice.secondTaxEnabled,
                  })
                }
              >
                {form.invoice.secondTaxEnabled ? 'Disable' : 'Enable'} second
                tax
              </button>
            </div>
          </div>
          {form.invoice.secondTaxEnabled && (
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:ps-48">
              <span className="text-sm text-muted-foreground">Second tax</span>
              <input
                type="number"
                min={0}
                className={cn(inputCls, 'w-20 tabular-nums')}
                value={form.invoice.secondTaxPercent}
                onChange={(e) =>
                  set('invoice', {
                    ...form.invoice,
                    secondTaxPercent: Number(e.target.value) || 0,
                  })
                }
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          )}
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <span className={labelCls}>Discount</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                className={cn(inputCls, 'w-20 tabular-nums')}
                value={form.invoice.discountPercent}
                onChange={(e) =>
                  set('invoice', {
                    ...form.invoice,
                    discountPercent: Number(e.target.value) || 0,
                  })
                }
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 pt-2">
        <Button
          type="button"
          size="lg"
          className="min-w-36"
          onClick={onSave}
          disabled={busy}
        >
          {busy ? 'Saving…' : 'Save project'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(-1)}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
