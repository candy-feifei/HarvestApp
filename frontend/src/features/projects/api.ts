import { apiRequest } from '@/lib/api/http'
import type {
  ProjectFormValues,
  ProjectRecord,
  ProjectMetadata,
  ApiBillingMethod,
  ProjectsPaginatedResponse,
} from './types'

/** 与根路径拼接后为 `GET/POST /api/projects` */
export const projectsResourcePath = '/projects'

function withQuery(path: string, q: Record<string, string | number | undefined>) {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) {
    if (v != null && v !== '') u.set(k, String(v))
  }
  const s = u.toString()
  return s ? `${path}?${s}` : path
}

/**
 * 任务/团队由 API `tasks` / `assignments` 写入表，不写入 metadata。
 */
function buildMetadataFromForm(
  form: ProjectFormValues,
  existing: ProjectMetadata | null,
): ProjectMetadata {
  const e = existing ?? {}
  const { tasks: _dropT, team: _dropG, ...kept } = e
  return {
    ...kept,
    billableRateMode: form.billableRateMode,
    reportPermission: form.reportPermission,
    spentAmount: form.spentAmount,
    costsAmount: form.costsAmount,
    primaryManagerUserId: form.primaryManagerUserId,
    invoice: form.invoice,
  }
}

function formTasksToApiBody(form: ProjectFormValues) {
  return form.tasks.map((t) => ({
    taskId: t.taskId,
    isBillable: t.isBillable,
    hourlyRate: t.hourlyRate,
  }))
}

function formTeamToAssignmentsBody(form: ProjectFormValues) {
  return form.team.map((m) => ({
    userId: m.userId,
    isManager: m.isManager,
    projectBillableRate: m.billableRate,
  }))
}

function uiTypeToApi(t: ProjectFormValues['projectType']): ApiBillingMethod {
  if (t === 'time_materials') return 'TM'
  if (t === 'fixed_fee') return 'FIXED_FEE'
  return 'NON_BILLABLE'
}

function projectHourlyForApi(form: ProjectFormValues): number | null {
  if (form.projectType !== 'time_materials') return null
  if (form.billableRateMode === 'no_rate') return null
  if (form.billableRateMode !== 'project_rate') return null
  return form.projectHourlyRate
}

/** T&M and Fixed fee do not use the budget fields in the UI; persist as no budget. */
function budgetPayloadForForm(form: ProjectFormValues) {
  if (form.projectType === 'time_materials' || form.projectType === 'fixed_fee') {
    return { budgetType: 'NO_BUDGET' as const, budgetAmount: null as null }
  }
  return {
    budgetType: form.budgetType,
    budgetAmount:
      form.budgetType === 'NO_BUDGET' ? null : (form.budgetAmount ?? null),
  }
}

export function formValuesToCreatePayload(form: ProjectFormValues) {
  const billingMethod = uiTypeToApi(form.projectType)
  const isBillable = form.projectType !== 'non_billable'
  const metadata = buildMetadataFromForm(form, null)
  const b = budgetPayloadForForm(form)
  return {
    clientId: form.clientId,
    name: form.name.trim(),
    code: form.projectCode.trim() || undefined,
    isBillable,
    billingMethod,
    hourlyRate: projectHourlyForApi(form) ?? undefined,
    fixedFee:
      form.projectType === 'fixed_fee' ? form.projectFees : undefined,
    budgetType: b.budgetType,
    budgetAmount:
      b.budgetType === 'NO_BUDGET' ? undefined : (b.budgetAmount ?? undefined),
    isArchived: false,
    isPinned: false,
    startsOn: form.startDate.trim()
      ? `${form.startDate.trim()}T00:00:00.000Z`
      : undefined,
    endsOn: form.endDate.trim()
      ? `${form.endDate.trim()}T00:00:00.000Z`
      : undefined,
    notes: form.notes.trim() || undefined,
    metadata: metadata as unknown as Record<string, unknown>,
    tasks: formTasksToApiBody(form),
    assignments: formTeamToAssignmentsBody(form),
  }
}

export function formValuesToUpdatePayload(
  form: ProjectFormValues,
  previous: ProjectRecord,
) {
  const billingMethod = uiTypeToApi(form.projectType)
  const isBillable = form.projectType !== 'non_billable'
  const metadata = buildMetadataFromForm(
    form,
    previous.metadata as ProjectMetadata | null,
  )
  const b = budgetPayloadForForm(form)
  return {
    clientId: form.clientId,
    name: form.name.trim(),
    code: form.projectCode.trim() || undefined,
    isBillable,
    billingMethod,
    hourlyRate: projectHourlyForApi(form) ?? null,
    fixedFee:
      form.projectType === 'fixed_fee' ? form.projectFees : null,
    budgetType: b.budgetType,
    budgetAmount:
      b.budgetType === 'NO_BUDGET' ? null : b.budgetAmount,
    startsOn: form.startDate.trim()
      ? `${form.startDate.trim()}T00:00:00.000Z`
      : null,
    endsOn: form.endDate.trim()
      ? `${form.endDate.trim()}T00:00:00.000Z`
      : null,
    notes: form.notes.trim() || null,
    metadata: metadata as unknown as Record<string, unknown>,
    tasks: formTasksToApiBody(form),
    assignments: formTeamToAssignmentsBody(form),
  }
}

export function getProjects(page = 1, pageSize = 100) {
  return apiRequest<ProjectsPaginatedResponse>(
    withQuery(projectsResourcePath, { page, pageSize }),
    { method: 'GET' },
  )
}

export function getProject(id: string) {
  return apiRequest<ProjectRecord>(`${projectsResourcePath}/${id}`, {
    method: 'GET',
  })
}

export function createProject(
  data: ReturnType<typeof formValuesToCreatePayload>,
) {
  return apiRequest<ProjectRecord>(projectsResourcePath, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateProject(
  id: string,
  data: ReturnType<typeof formValuesToUpdatePayload> | Record<string, unknown>,
) {
  return apiRequest<ProjectRecord>(`${projectsResourcePath}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteProject(id: string) {
  return apiRequest<{ id: string }>(`${projectsResourcePath}/${id}`, {
    method: 'DELETE',
  })
}
