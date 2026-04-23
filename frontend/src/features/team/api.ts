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
