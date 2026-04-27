import { apiRequest } from '@/lib/api/http'

export type TeamMemberRow = {
  memberId: string
  userId: string
  systemRole: string
  email: string
  firstName: string
  lastName: string
  invitationStatus: string
  weeklyCapacity: number
  isPinned: boolean
  employeeId: string | null
  employmentType: 'EMPLOYEE' | 'CONTRACTOR'
  jobLabel: string | null
  defaultBillableRatePerHour: number
  costRatePerHour: number
}

export function listTeamMembers() {
  return apiRequest<{ items: TeamMemberRow[] }>('/organizations/members', {
    method: 'GET',
  })
}

export type InviteMemberPayload = {
  firstName: string
  lastName: string
  workEmail: string
  employeeId?: string
  employmentType: 'EMPLOYEE' | 'CONTRACTOR'
  jobLabel?: string
  weeklyCapacity: number
  defaultBillableRatePerHour?: number
  costRatePerHour?: number
}

export function inviteTeamMember(body: InviteMemberPayload) {
  return apiRequest<{
    userId: string
    memberId: string
    email: string
    emailSent: boolean
    setPasswordUrl?: string
  }>('/organizations/members/invite', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export type TeamWeeklySummaryItem = {
  memberId: string
  userId: string
  email: string
  firstName: string
  lastName: string
  invitationStatus: string
  systemRole: string
  isPinned: boolean
  weeklyCapacity: number
  hours: number
  billableHours: number
  nonBillableHours: number
  utilizationPercent: number
}

export type TeamWeeklySummary = {
  range: {
    weekOf: string
    from: string
    toExclusive: string
  }
  totals: {
    totalHours: number
    billableHours: number
    nonBillableHours: number
    teamCapacity: number
  }
  items: TeamWeeklySummaryItem[]
}

export function getTeamWeeklySummary(week?: string) {
  const qs = week ? `?week=${encodeURIComponent(week)}` : ''
  return apiRequest<TeamWeeklySummary>(`/organizations/team/weekly${qs}`, {
    method: 'GET',
  })
}

export type SystemRoleName = 'MEMBER' | 'MANAGER' | 'ADMINISTRATOR'

export type ManagerPermissions = {
  createEditManagedProjects: boolean
  createEditAllClientsTasks: boolean
  createEditTimeExpensesManaged: boolean
  seeEditBillableRatesManaged: boolean
  createEditDraftInvoices: boolean
  manageAllInvoices: boolean
  createEditAllEstimates: boolean
  withdrawApprovals: boolean
}

export type TeamMemberDetail = {
  memberId: string
  userId: string
  email: string
  firstName: string
  lastName: string
  invitationStatus: string
  timezone: string
  /** 用户头像（如 `/api/uploads/avatars/...`）或 null */
  avatarUrl?: string | null
  emailNotifyManagedPeopleTimesheets?: boolean
  emailNotifyManagedProjectTimesheets?: boolean
  employeeId: string | null
  employmentType: 'EMPLOYEE' | 'CONTRACTOR'
  jobLabel: string | null
  weeklyCapacity: number
  systemRole: string
  managerPermissions?: ManagerPermissions
  isPinned: boolean
  status: string
  /** 新 API 字段；旧环境可能暂时缺省 */
  assignAllFutureProjects?: boolean
  defaultBillableRatePerHour: number
  costRatePerHour: number
}

export function getTeamMember(memberId: string) {
  return apiRequest<TeamMemberDetail>(`/organizations/members/${memberId}`, {
    method: 'GET',
  })
}

export type UpdateTeamMemberPayload = Partial<{
  firstName: string
  lastName: string
  workEmail: string
  employeeId: string
  employmentType: 'EMPLOYEE' | 'CONTRACTOR'
  jobLabel: string
  weeklyCapacity: number
  timezone: string
  systemRole: SystemRoleName
  managerPermissions: ManagerPermissions
  isPinned: boolean
  avatarUrl: string
  emailNotifyManagedPeopleTimesheets: boolean
  emailNotifyManagedProjectTimesheets: boolean
}>

export function updateTeamMember(memberId: string, body: UpdateTeamMemberPayload) {
  return apiRequest<TeamMemberDetail>(`/organizations/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

/** 上传成员头像，返回可写入 `avatarUrl` 的路径。 */
export function uploadMemberAvatar(file: File) {
  const body = new FormData()
  body.append('file', file)
  return apiRequest<{ avatarUrl: string }>('/uploads/avatar', {
    method: 'POST',
    body,
  })
}

export function archiveTeamMember(memberId: string) {
  return apiRequest<{ archived: true; memberId: string }>(
    `/organizations/members/${memberId}/archive`,
    { method: 'POST' },
  )
}

export type ArchivedTeamMemberRow = Omit<TeamMemberRow, 'isPinned'> & {
  archivedAt: string | null
}

export function listArchivedTeamMembers() {
  return apiRequest<{ items: ArchivedTeamMemberRow[] }>(
    '/organizations/members/archived',
    { method: 'GET' },
  )
}

export function restoreTeamMember(memberId: string) {
  return apiRequest<{ restored: true; memberId: string }>(
    `/organizations/members/${memberId}/restore`,
    { method: 'POST' },
  )
}

export function removeTeamMember(memberId: string) {
  return apiRequest<{ deleted: true; memberId: string }>(
    `/organizations/members/${memberId}`,
    { method: 'DELETE' },
  )
}

/** 仅组织管理员：为该成员设置新的登录密码。 */
export function setTeamMemberPassword(
  memberId: string,
  body: { newPassword: string },
) {
  return apiRequest<{ updated: true; memberId: string }>(
    `/organizations/members/${memberId}/password`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export function resendTeamInvitation(memberId: string) {
  return apiRequest<{ email: string; emailSent: boolean; setPasswordUrl?: string }>(
    `/organizations/members/${memberId}/resend-invitation`,
    { method: 'POST' },
  )
}

export type MemberRateRow = {
  id: string
  billableRatePerHour: number
  costRatePerHour: number
  startDate: string
  endDate: string | null
  isCurrent: boolean
}

export function listMemberRates(memberId: string) {
  return apiRequest<{ items: MemberRateRow[] }>(
    `/organizations/members/${memberId}/rates`,
    { method: 'GET' },
  )
}

export type CreateMemberRatePayload = Partial<{
  billableRatePerHour: number
  costRatePerHour: number
  startDate: string // YYYY-MM-DD
}>

export function createMemberRate(memberId: string, body: CreateMemberRatePayload) {
  return apiRequest<{ item: MemberRateRow }>(
    `/organizations/members/${memberId}/rates`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export type UpdateMemberRatePayload = Partial<{
  billableRatePerHour: number
  costRatePerHour: number
  startDate: string
}>

export function updateMemberRate(
  memberId: string,
  rateId: string,
  body: UpdateMemberRatePayload,
) {
  return apiRequest<{ item: MemberRateRow }>(
    `/organizations/members/${memberId}/rates/${rateId}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )
}

export function deleteMemberRate(memberId: string, rateId: string) {
  return apiRequest<{ deleted: true }>(
    `/organizations/members/${memberId}/rates/${rateId}`,
    { method: 'DELETE' },
  )
}

export type MemberProjectRow = {
  id: string
  name: string
  code: string | null
  isAssigned: boolean
  isManager: boolean
}

export type MemberProjectClientGroup = {
  id: string
  name: string
  projects: MemberProjectRow[]
}

export type MemberProjectAssignmentsResponse = {
  memberId: string
  userId: string
  assignAllFutureProjects: boolean
  clients: MemberProjectClientGroup[]
}

export function getMemberProjectAssignments(
  memberId: string,
  query?: { q?: string },
) {
  const qs = query?.q
    ? `?q=${encodeURIComponent(query.q)}`
    : ''
  return apiRequest<MemberProjectAssignmentsResponse>(
    `/organizations/members/${memberId}/project-assignments${qs}`,
    { method: 'GET' },
  )
}

export type SetMemberProjectAssignmentsPayload = {
  assignments: { projectId: string; isManager: boolean }[]
  assignAllFutureProjects?: boolean
}

export function setMemberProjectAssignments(
  memberId: string,
  body: SetMemberProjectAssignmentsPayload,
) {
  return apiRequest<MemberProjectAssignmentsResponse>(
    `/organizations/members/${memberId}/project-assignments`,
    { method: 'PUT', body: JSON.stringify(body) },
  )
}

export type TeamCustomRoleMember = {
  memberId: string
  firstName: string
  lastName: string
  email: string
}

export type TeamCustomRole = {
  id: string
  name: string
  members: TeamCustomRoleMember[]
}

export function listTeamRoles() {
  return apiRequest<{ items: TeamCustomRole[] }>('/organizations/roles', {
    method: 'GET',
  })
}

export type CreateTeamRolePayload = {
  name: string
  memberUserOrganizationIds?: string[]
}

export function createTeamRole(body: CreateTeamRolePayload) {
  return apiRequest<TeamCustomRole>('/organizations/roles', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export type UpdateTeamRolePayload = Partial<{
  name: string
  memberUserOrganizationIds: string[]
}>

export function updateTeamRole(roleId: string, body: UpdateTeamRolePayload) {
  return apiRequest<TeamCustomRole>(`/organizations/roles/${roleId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteTeamRole(roleId: string) {
  return apiRequest<{ deleted: true; roleId: string }>(
    `/organizations/roles/${roleId}`,
    { method: 'DELETE' },
  )
}
