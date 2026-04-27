import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchOrganizationContext } from '@/features/clients/api'
import {
  getTeamMember,
  listMemberRates,
  listTeamRoles,
  createMemberRate,
  deleteMemberRate,
  resendTeamInvitation,
  updateMemberRate,
  updateTeamMember,
  uploadMemberAvatar,
  type MemberRateRow,
  type UpdateMemberRatePayload,
  type UpdateTeamMemberPayload,
} from '@/features/team/api'
import { TeamMemberAssignedProjectsPanel } from '@/features/team/components/team-member-assigned-projects'
import { TeamMemberPermissionsPanel } from '@/features/team/components/team-member-permissions-panel'
import { TeamMemberSecurityPanel } from '@/features/team/components/team-member-security-panel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  fieldWrap,
  inputCls,
  labelCls,
  selectCls,
} from '@/features/clients/client-form-helpers'

const CAPACITY_OPTIONS = [20, 25, 30, 35, 40, 45, 50, 60] as const

/** IANA ids + Harvest-like labels (fixed offsets; not DST-aware). */
const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'UTC', label: '(GMT) UTC' },
  { value: 'America/Los_Angeles', label: '(GMT-08:00) Pacific Time' },
  { value: 'America/Denver', label: '(GMT-07:00) Mountain Time' },
  { value: 'America/Chicago', label: '(GMT-06:00) Central Time' },
  { value: 'America/New_York', label: '(GMT-05:00) Eastern Time' },
  { value: 'Europe/London', label: '(GMT) London' },
  { value: 'Europe/Paris', label: '(GMT+01:00) Paris' },
  { value: 'Asia/Dubai', label: '(GMT+04:00) Dubai' },
  { value: 'Asia/Shanghai', label: '(GMT+08:00) Beijing' },
  { value: 'Asia/Tokyo', label: '(GMT+09:00) Tokyo' },
  { value: 'Australia/Sydney', label: '(GMT+10:00) Sydney' },
]

type LeftTabId = 'basic' | 'rates' | 'assignedProjects' | 'assignedPeople' | 'permissions' | 'security'

const leftItemBase =
  'w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40'

export function TeamMemberEditPage() {
  const { memberId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<LeftTabId>('basic')
  const id = memberId ?? ''

  const q = useQuery({
    queryKey: ['team', 'member', id],
    queryFn: () => getTeamMember(id),
    enabled: Boolean(id),
  })

  const orgCtxQ = useQuery({
    queryKey: ['organization', 'context'],
    queryFn: fetchOrganizationContext,
  })

  const ratesQ = useQuery({
    queryKey: ['team', 'member', id, 'rates'],
    queryFn: () => listMemberRates(id),
    enabled: Boolean(id) && tab === 'rates',
  })

  const teamRolesQ = useQuery({
    queryKey: ['team', 'roles'],
    queryFn: listTeamRoles,
    enabled: Boolean(id) && tab === 'basic',
  })

  const member = q.data
  const canEditProjectAssignments = useMemo(() => {
    if (orgCtxQ.isLoading) return false
    const role = orgCtxQ.data?.systemRole
    return role === 'ADMINISTRATOR' || role === 'MANAGER'
  }, [orgCtxQ.isLoading, orgCtxQ.data?.systemRole])
  const canChangePermissions = useMemo(() => {
    if (orgCtxQ.isLoading) return false
    return orgCtxQ.data?.systemRole === 'ADMINISTRATOR'
  }, [orgCtxQ.isLoading, orgCtxQ.data?.systemRole])
  const isViewingSelf = useMemo(
    () => Boolean(id && orgCtxQ.data?.memberId === id),
    [id, orgCtxQ.data?.memberId],
  )
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [workEmail, setWorkEmail] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [employmentType, setEmploymentType] = useState<'EMPLOYEE' | 'CONTRACTOR'>(
    'EMPLOYEE',
  )
  const [jobLabel, setJobLabel] = useState('')
  const [weeklyCapacity, setWeeklyCapacity] = useState(40)
  const [timezone, setTimezone] = useState('UTC')
  const [emailNotifyManagedPeople, setEmailNotifyManagedPeople] = useState(true)
  const [emailNotifyManagedProjects, setEmailNotifyManagedProjects] =
    useState(true)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const canEdit = useMemo(() => tab === 'basic', [tab])

  const [avatarObjectUrl, setAvatarObjectUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!avatarFile) {
      setAvatarObjectUrl(null)
      return
    }
    const u = URL.createObjectURL(avatarFile)
    setAvatarObjectUrl(u)
    return () => {
      URL.revokeObjectURL(u)
    }
  }, [avatarFile])

  const displayAvatarSrc =
    removeAvatar ? null : (avatarObjectUrl ?? member?.avatarUrl ?? null)

  const timezoneOptions = useMemo(() => {
    if (!member?.timezone) return TIMEZONE_OPTIONS
    if (TIMEZONE_OPTIONS.some((o) => o.value === member.timezone)) {
      return TIMEZONE_OPTIONS
    }
    return [
      { value: member.timezone, label: `${member.timezone} (current)` },
      ...TIMEZONE_OPTIONS,
    ]
  }, [member?.timezone])

  /** 组织里配置的角色名；若当前 jobLabel 不在列表中则保留一条以兼容历史数据 */
  const jobRoleSelectOptions = useMemo(() => {
    const items = teamRolesQ.data?.items ?? []
    const fromOrg = new Set(
      items
        .map((r) => r.name.trim())
        .filter((n) => n.length > 0),
    )
    const current = jobLabel.trim()
    if (current && !fromOrg.has(current)) {
      fromOrg.add(current)
    }
    return [...fromOrg].sort((a, b) => a.localeCompare(b))
  }, [teamRolesQ.data?.items, jobLabel])

  useEffect(() => {
    setIsDirty(false)
  }, [id])

  useEffect(() => {
    if (!member) return
    if (isDirty) return
    setFirstName(member.firstName)
    setLastName(member.lastName)
    setWorkEmail(member.email)
    setEmployeeId(member.employeeId ?? '')
    setEmploymentType(member.employmentType)
    setJobLabel(member.jobLabel ?? '')
    setWeeklyCapacity(member.weeklyCapacity ?? 40)
    setTimezone(
      member.timezone && member.timezone.trim() ? member.timezone : 'UTC',
    )
    setEmailNotifyManagedPeople(
      member.emailNotifyManagedPeopleTimesheets !== false,
    )
    setEmailNotifyManagedProjects(
      member.emailNotifyManagedProjectTimesheets !== false,
    )
    setAvatarFile(null)
    setRemoveAvatar(false)
  }, [member, isDirty, id])

  const saveMut = useMutation({
    mutationFn: async () => {
      let avatarUrl: string | undefined
      if (removeAvatar) {
        avatarUrl = ''
      } else if (avatarFile) {
        const { avatarUrl: uploaded } = await uploadMemberAvatar(avatarFile)
        avatarUrl = uploaded
      }
      const payload: UpdateTeamMemberPayload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        workEmail: workEmail.trim(),
        employeeId: employeeId.trim(),
        employmentType,
        jobLabel: jobLabel.trim(),
        weeklyCapacity,
        timezone: timezone.trim(),
        emailNotifyManagedPeopleTimesheets: emailNotifyManagedPeople,
        emailNotifyManagedProjectTimesheets: emailNotifyManagedProjects,
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      }
      return updateTeamMember(id, payload)
    },
    onSuccess: async () => {
      setIsDirty(false)
      setAvatarFile(null)
      setRemoveAvatar(false)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['team', 'weekly'] }),
        qc.invalidateQueries({ queryKey: ['team', 'member', id] }),
      ])
    },
  })

  const [showBillForm, setShowBillForm] = useState(false)
  const [showCostForm, setShowCostForm] = useState(false)
  const [billRate, setBillRate] = useState('')
  const [billStart, setBillStart] = useState('')
  const [costRate, setCostRate] = useState('')
  const [costStart, setCostStart] = useState('')
  const [billInline, setBillInline] = useState<{
    id: string
    amount: string
    start: string
  } | null>(null)
  const [costInline, setCostInline] = useState<{
    id: string
    amount: string
    start: string
  } | null>(null)

  function parseMoney(s: string): number | undefined {
    const t = s.trim()
    if (t === '') return undefined
    const n = Number(t)
    if (Number.isNaN(n) || n < 0) return undefined
    return Math.round(n * 100) / 100
  }

  const createRateMut = useMutation({
    mutationFn: (body: Parameters<typeof createMemberRate>[1]) =>
      createMemberRate(id, body),
    onSuccess: async () => {
      await ratesQ.refetch()
      await q.refetch()
      setShowBillForm(false)
      setShowCostForm(false)
      setBillRate('')
      setBillStart('')
      setCostRate('')
      setCostStart('')
      setBillInline(null)
      setCostInline(null)
    },
  })

  const updateRateMut = useMutation({
    mutationFn: (args: { rateId: string; body: UpdateMemberRatePayload }) =>
      updateMemberRate(id, args.rateId, args.body),
    onSuccess: async () => {
      await ratesQ.refetch()
      await q.refetch()
      setBillInline(null)
      setCostInline(null)
    },
  })

  const deleteRateMut = useMutation({
    mutationFn: (rateId: string) => deleteMemberRate(id, rateId),
    onSuccess: async () => {
      await ratesQ.refetch()
      await q.refetch()
    },
  })

  const ratesPending = createRateMut.isPending || updateRateMut.isPending

  const resendMut = useMutation({
    mutationFn: () => resendTeamInvitation(id),
  })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canEdit) return
    await saveMut.mutateAsync()
  }

  if (!id) {
    return (
      <div className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-4">
        <p className="text-sm text-destructive">Missing memberId</p>
      </div>
    )
  }

  if (q.isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-4">
        <p className="text-sm text-muted-foreground">Loading member...</p>
      </div>
    )
  }

  if (q.isError || !member) {
    return (
      <div className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-4">
        <p className="text-sm text-destructive">Failed to load member.</p>
        <div className="mt-4">
          <Button asChild variant="outline" className="h-9 border-border">
            <Link to="/team">Back to Team</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-4">
      <Button
        type="button"
        variant="ghost"
        className="h-9 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
        onClick={() => navigate('/team')}
      >
        ← Back to Team
      </Button>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-md border border-border bg-white p-3 shadow-sm">
          <div className="flex items-center gap-3 px-2 py-2">
            {displayAvatarSrc ? (
              <img
                src={displayAvatarSrc}
                alt=""
                className="size-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                {(member.firstName[0] ?? '').toUpperCase()}
                {(member.lastName[0] ?? '').toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">
                {member.firstName} {member.lastName}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {member.email}
              </div>
            </div>
          </div>

          <nav className="mt-2 space-y-1">
            <button
              type="button"
              className={cn(
                leftItemBase,
                tab === 'basic'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground',
              )}
              onClick={() => setTab('basic')}
            >
              Basic info
            </button>
            <button
              type="button"
              className={cn(
                leftItemBase,
                tab === 'rates'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground',
              )}
              onClick={() => setTab('rates')}
            >
              Rates
            </button>
            <button
              type="button"
              className={cn(
                leftItemBase,
                tab === 'assignedProjects'
                  ? 'border border-amber-200/80 bg-amber-50/90 text-foreground'
                  : 'text-muted-foreground',
              )}
              onClick={() => setTab('assignedProjects')}
            >
              Assigned projects
            </button>
            <button
              type="button"
              className={cn(
                leftItemBase,
                tab === 'assignedPeople'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground',
              )}
              onClick={() => setTab('assignedPeople')}
            >
              Assigned people
            </button>
            <button
              type="button"
              className={cn(
                leftItemBase,
                tab === 'permissions'
                  ? 'border border-amber-200/80 bg-amber-50/90 text-foreground'
                  : 'text-muted-foreground',
              )}
              onClick={() => setTab('permissions')}
            >
              Permissions
            </button>
            <button
              type="button"
              className={cn(
                leftItemBase,
                tab === 'security'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground',
              )}
              onClick={() => setTab('security')}
            >
              Security
            </button>
          </nav>
        </aside>

        <main className="rounded-md border border-border bg-white px-4 py-4 shadow-sm sm:px-6 sm:py-5">
          {tab === 'rates' ? (
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {member.firstName}&apos;s default rates
              </h1>

              <div className="mt-6 space-y-8">
                <section>
                  <h2 className="text-base font-semibold text-foreground">
                    Billable rates
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The rate you bill clients for this person's time. We'll apply these rates to all projects that use their default rate. You can override this rate on each project. Only Administrators and Managers with permission can see billable rates and amounts.
                  </p>

                  <div className="mt-3">
                    <Button
                      type="button"
                      className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => {
                        setBillInline(null)
                        setShowBillForm((v) => !v)
                      }}
                    >
                      + New billable rate
                    </Button>
                  </div>

                  {showBillForm ? (
                    <div className="mt-3 rounded-md border border-border bg-muted/20 p-4">
                      <div className={fieldWrap}>
                        <span className={labelCls}>Default billable rate</span>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
                          <span className="text-muted-foreground">$</span>
                          <input
                            id="bill-rate"
                            className={cn(inputCls, 'h-9 w-[100px]')}
                            inputMode="decimal"
                            value={billRate}
                            onChange={(e) => setBillRate(e.target.value)}
                            placeholder="0.00"
                            aria-label="Billable amount per hour"
                          />
                          <span className="text-muted-foreground">
                            per hour starting on
                          </span>
                          <input
                            id="bill-start"
                            type="date"
                            className={cn(inputCls, 'h-9 w-[160px]')}
                            value={billStart}
                            onChange={(e) => setBillStart(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                          disabled={ratesPending}
                          onClick={() =>
                            createRateMut.mutate({
                              billableRatePerHour: parseMoney(billRate),
                              startDate: billStart || undefined,
                            })
                          }
                        >
                          {createRateMut.isPending
                            ? 'Saving...'
                            : 'Add billable rate'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 border-border"
                          onClick={() => {
                            setShowBillForm(false)
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <RatesTable
                    loading={ratesQ.isLoading}
                    rows={ratesQ.data?.items ?? []}
                    kind="billable"
                    inlineEdit={billInline}
                    setInlineEdit={setBillInline}
                    isSaving={updateRateMut.isPending}
                    onStartEdit={(row) => {
                      setShowBillForm(false)
                      setCostInline(null)
                      setBillInline({
                        id: row.id,
                        amount: String(row.billableRatePerHour),
                        start: row.startDate.slice(0, 10),
                      })
                    }}
                    onCancelEdit={() => setBillInline(null)}
                    onSaveInline={() => {
                      if (!billInline) return
                      updateRateMut.mutate({
                        rateId: billInline.id,
                        body: {
                          billableRatePerHour: parseMoney(billInline.amount),
                          startDate: billInline.start || undefined,
                        },
                      })
                    }}
                    onDelete={(rateId) => deleteRateMut.mutate(rateId)}
                  />
                </section>

                <section>
                  <h2 className="text-base font-semibold text-foreground">
                    Cost rates
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The internal cost that this person incurs on your business. Cost rates apply to all projects. Only Administrators can see cost rates and amounts.
                  </p>

                  <div className="mt-3">
                    <Button
                      type="button"
                      className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => {
                        setCostInline(null)
                        setShowCostForm((v) => !v)
                      }}
                    >
                      + New cost rate
                    </Button>
                  </div>

                  {showCostForm ? (
                    <div className="mt-3 rounded-md border border-border bg-muted/20 p-4">
                      <div className={fieldWrap}>
                        <span className={labelCls}>Default cost rate</span>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
                          <span className="text-muted-foreground">$</span>
                          <input
                            id="cost-rate"
                            className={cn(inputCls, 'h-9 w-[100px]')}
                            inputMode="decimal"
                            value={costRate}
                            onChange={(e) => setCostRate(e.target.value)}
                            placeholder="0.00"
                            aria-label="Cost amount per hour"
                          />
                          <span className="text-muted-foreground">
                            per hour starting on
                          </span>
                          <input
                            id="cost-start"
                            type="date"
                            className={cn(inputCls, 'h-9 w-[160px]')}
                            value={costStart}
                            onChange={(e) => setCostStart(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                          disabled={ratesPending}
                          onClick={() =>
                            createRateMut.mutate({
                              costRatePerHour: parseMoney(costRate),
                              startDate: costStart || undefined,
                            })
                          }
                        >
                          {createRateMut.isPending ? 'Saving...' : 'Add cost rate'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 border-border"
                          onClick={() => {
                            setShowCostForm(false)
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <RatesTable
                    loading={ratesQ.isLoading}
                    rows={ratesQ.data?.items ?? []}
                    kind="cost"
                    inlineEdit={costInline}
                    setInlineEdit={setCostInline}
                    isSaving={updateRateMut.isPending}
                    onStartEdit={(row) => {
                      setShowCostForm(false)
                      setBillInline(null)
                      setCostInline({
                        id: row.id,
                        amount: String(row.costRatePerHour),
                        start: row.startDate.slice(0, 10),
                      })
                    }}
                    onCancelEdit={() => setCostInline(null)}
                    onSaveInline={() => {
                      if (!costInline) return
                      updateRateMut.mutate({
                        rateId: costInline.id,
                        body: {
                          costRatePerHour: parseMoney(costInline.amount),
                          startDate: costInline.start || undefined,
                        },
                      })
                    }}
                    onDelete={(rateId) => deleteRateMut.mutate(rateId)}
                  />
                </section>
              </div>
            </div>
          ) : tab === 'permissions' ? (
            <TeamMemberPermissionsPanel
              member={member}
              canEdit={canChangePermissions}
            />
          ) : tab === 'assignedProjects' ? (
            <TeamMemberAssignedProjectsPanel
              memberId={id}
              firstName={member.firstName}
              isActive={tab === 'assignedProjects'}
              canEdit={canEditProjectAssignments}
            />
          ) : tab === 'basic' ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {member.firstName}&apos;s basic info
              </h1>

              {member.invitationStatus === 'INVITED' ? (
                <div className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    This person hasn't signed in yet.
                  </span>{' '}
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() => resendMut.mutate()}
                    disabled={resendMut.isPending}
                  >
                    {resendMut.isPending ? 'Sending...' : 'Resend invitation'}
                  </button>
                </div>
              ) : null}

              <form onSubmit={onSubmit} className="mt-6 space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className={fieldWrap}>
                    <label className={labelCls} htmlFor="m-first">
                      First name
                    </label>
                    <input
                      id="m-first"
                      className={inputCls}
                      value={firstName}
                      onChange={(e) => {
                        setIsDirty(true)
                        setFirstName(e.target.value)
                      }}
                      required
                    />
                  </div>
                  <div className={fieldWrap}>
                    <label className={labelCls} htmlFor="m-last">
                      Last name
                    </label>
                    <input
                      id="m-last"
                      className={inputCls}
                      value={lastName}
                      onChange={(e) => {
                        setIsDirty(true)
                        setLastName(e.target.value)
                      }}
                      required
                    />
                  </div>
                </div>

                <div className={fieldWrap}>
                  <label className={labelCls} htmlFor="m-email">
                    Work email
                  </label>
                  <input
                    id="m-email"
                    type="email"
                    className={inputCls}
                    value={workEmail}
                    onChange={(e) => {
                      setIsDirty(true)
                      setWorkEmail(e.target.value)
                    }}
                    required
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Changing this person's email will send an invitation to the new email. This person will not have access to this account until they accept the new invitation.
                  </p>
                </div>

                <div className={fieldWrap}>
                  <label className={labelCls} htmlFor="m-empid">
                    Employee ID
                  </label>
                  <input
                    id="m-empid"
                    className={inputCls}
                    value={employeeId}
                    onChange={(e) => {
                      setIsDirty(true)
                      setEmployeeId(e.target.value)
                    }}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Optional. A unique identifier for this employee within your organization.
                  </p>
                </div>

                <div className={fieldWrap}>
                  <span className={labelCls}>Type</span>
                  <div className="mt-1.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDirty(true)
                        setEmploymentType('EMPLOYEE')
                      }}
                      className={cn(
                        'h-9 flex-1 rounded-md border text-sm font-medium transition-colors',
                        employmentType === 'EMPLOYEE'
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-white text-muted-foreground hover:bg-muted/40',
                      )}
                    >
                      Employee
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDirty(true)
                        setEmploymentType('CONTRACTOR')
                      }}
                      className={cn(
                        'h-9 flex-1 rounded-md border text-sm font-medium transition-colors',
                        employmentType === 'CONTRACTOR'
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-white text-muted-foreground hover:bg-muted/40',
                      )}
                    >
                      Contractor
                    </button>
                  </div>
                </div>

                <div className={fieldWrap}>
                  <label className={labelCls} htmlFor="m-roles">
                    Roles
                  </label>
                  <select
                    id="m-roles"
                    className={cn(selectCls, 'max-w-full sm:max-w-md')}
                    value={jobLabel}
                    onChange={(e) => {
                      setIsDirty(true)
                      setJobLabel(e.target.value)
                    }}
                    disabled={teamRolesQ.isLoading}
                  >
                    <option value="">— None —</option>
                    {jobRoleSelectOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Options come from your organization&apos;s role list. Roles help
                    organize the Team section and other reports.{' '}
                    <Link
                      to="/team?tab=roles"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      Manage roles
                    </Link>
                    {teamRolesQ.isError ? (
                      <span className="ml-1 text-destructive">
                        (Could not load role list.)
                      </span>
                    ) : null}
                  </p>
                </div>

                <div className={fieldWrap}>
                  <label className={labelCls} htmlFor="m-cap">
                    Capacity
                  </label>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <select
                      id="m-cap"
                      className={cn(selectCls, 'max-w-[200px]')}
                      value={weeklyCapacity}
                      onChange={(e) => {
                        setIsDirty(true)
                        setWeeklyCapacity(Number(e.target.value))
                      }}
                    >
                      {CAPACITY_OPTIONS.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <span className="text-sm text-muted-foreground">
                      hours per week
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    The number of hours per week this person is available to work.
                  </p>
                </div>

                <div className={fieldWrap}>
                  <span className={labelCls}>Rates</span>
                  <button
                    type="button"
                    className="text-sm text-primary underline-offset-2 hover:underline"
                    onClick={() => setTab('rates')}
                  >
                    Edit rates
                  </button>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Current defaults: Billable $
                    {member.defaultBillableRatePerHour.toFixed(2)}/h, Cost $
                    {member.costRatePerHour.toFixed(2)}/h
                  </p>
                </div>

                <div className={fieldWrap}>
                  <label className={labelCls} htmlFor="m-tz">
                    Timezone
                  </label>
                  <select
                    id="m-tz"
                    className={cn(selectCls, 'max-w-full sm:max-w-md')}
                    value={timezone}
                    onChange={(e) => {
                      setIsDirty(true)
                      setTimezone(e.target.value)
                    }}
                  >
                    {timezoneOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={fieldWrap}>
                  <span className={labelCls}>Photo</span>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3">
                    <input
                      id="m-photo"
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="text-sm file:mr-2 file:rounded file:border file:border-border file:bg-white file:px-2 file:py-1.5"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) {
                          setIsDirty(true)
                          setRemoveAvatar(false)
                          setAvatarFile(f)
                        }
                        e.target.value = ''
                      }}
                    />
                    {(Boolean(member.avatarUrl) || Boolean(avatarFile)) &&
                    !removeAvatar ? (
                      <button
                        type="button"
                        className="text-sm text-destructive underline-offset-2 hover:underline"
                        onClick={() => {
                          setIsDirty(true)
                          setAvatarFile(null)
                          setRemoveAvatar(true)
                        }}
                      >
                        Remove photo
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Suggested size: 100×100. JPEG, PNG, GIF, or WebP, up to 2&nbsp;MB.
                  </p>
                </div>

                <div className={fieldWrap}>
                  <span className={labelCls}>Notifications</span>
                  <div className="mt-2 space-y-2.5">
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 rounded border-border accent-primary"
                        checked={emailNotifyManagedPeople}
                        onChange={(e) => {
                          setIsDirty(true)
                          setEmailNotifyManagedPeople(e.target.checked)
                        }}
                      />
                      <span>
                        Email this person if timesheets are submitted for
                        people they manage
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 rounded border-border accent-primary"
                        checked={emailNotifyManagedProjects}
                        onChange={(e) => {
                          setIsDirty(true)
                          setEmailNotifyManagedProjects(e.target.checked)
                        }}
                      />
                      <span>
                        Email this person if timesheets are submitted for
                        projects they manage
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end sm:gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 border-border"
                    onClick={() => navigate('/team')}
                    disabled={saveMut.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={saveMut.isPending}
                  >
                    {saveMut.isPending ? 'Saving...' : 'Update info'}
                  </Button>
                </div>
              </form>
            </>
          ) : tab === 'security' ? (
            <TeamMemberSecurityPanel
              firstName={member.firstName}
              memberId={id}
              isViewingSelf={isViewingSelf}
              canSetOtherPassword={canChangePermissions}
            />
          ) : (
            <div className="text-sm text-muted-foreground">Coming soon.</div>
          )}
        </main>
      </div>
    </div>
  )
}

function RatesTable({
  loading,
  rows,
  kind,
  inlineEdit,
  setInlineEdit,
  isSaving,
  onStartEdit,
  onCancelEdit,
  onSaveInline,
  onDelete,
}: {
  loading: boolean
  rows: MemberRateRow[]
  kind: 'billable' | 'cost'
  inlineEdit: { id: string; amount: string; start: string } | null
  setInlineEdit: Dispatch<
    SetStateAction<{ id: string; amount: string; start: string } | null>
  >
  isSaving: boolean
  onStartEdit: (row: MemberRateRow) => void
  onCancelEdit: () => void
  onSaveInline: () => void
  onDelete: (rateId: string) => void
}) {
  function slashYmd(ymd: string) {
    const [y, m, d] = ymd.slice(0, 10).split('-')
    if (!y || !m || !d) return ymd
    return `${d}/${m}/${y}`
  }

  if (loading) {
    return (
      <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
        Loading rates...
      </p>
    )
  }

  const minStartAmongEnded = rows.reduce<string | null>((acc, row) => {
    if (!row.endDate) return acc
    const s = row.startDate.slice(0, 10)
    if (!acc || s < acc) return s
    return acc
  }, null)

  function displayEndLabel(r: MemberRateRow): string {
    if (!r.endDate) return 'All future'
    const end = r.endDate.slice(0, 10)
    const hasSegmentStartingAtEnd = rows.some(
      (x) => x.startDate.slice(0, 10) === end,
    )
    if (hasSegmentStartingAtEnd) return slashYmd(end)
    const [y, m, d] = end.split('-').map((p) => parseInt(p, 10))
    const t = Date.UTC(y, m - 1, d)
    const prev = new Date(t - 86400000)
    const py = prev.getUTCFullYear()
    const pm = String(prev.getUTCMonth() + 1).padStart(2, '0')
    const pd = String(prev.getUTCDate()).padStart(2, '0')
    return slashYmd(`${py}-${pm}-${pd}`)
  }

  return (
    <div className="mt-4 rounded-md border border-border">
      <div className="grid grid-cols-[88px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 border-b border-border bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground sm:px-4">
        <span />
        <span>Hourly rate</span>
        <span>Start date</span>
        <span>End date</span>
        <span className="text-right"> </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-sm text-muted-foreground sm:px-4">
          No rates yet.
        </p>
      ) : (
        rows.map((r) => {
          const editing = inlineEdit?.id === r.id
          const hourly =
            kind === 'billable' ? r.billableRatePerHour : r.costRatePerHour
          const startYmd = r.startDate.slice(0, 10)
          const startLabel =
            r.endDate &&
            minStartAmongEnded &&
            startYmd === minStartAmongEnded
              ? 'All prior'
              : slashYmd(startYmd)
          return (
            <div
              key={r.id}
              className={cn(
                'grid grid-cols-[88px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/80 px-3 py-2.5 text-sm last:border-b-0 sm:px-4',
                editing ? 'bg-amber-50/80' : 'bg-white',
              )}
            >
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-border px-2 text-xs"
                  disabled={editing}
                  onClick={() => onStartEdit(r)}
                >
                  Edit
                </Button>
              </div>

              {editing && inlineEdit ? (
                <>
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="text-sm text-muted-foreground">$</span>
                    <input
                      className={cn(inputCls, 'h-9')}
                      inputMode="decimal"
                      value={inlineEdit.amount}
                      onChange={(e) =>
                        setInlineEdit((prev) =>
                          prev && prev.id === r.id
                            ? { ...prev, amount: e.target.value }
                            : prev,
                        )
                      }
                    />
                  </div>
                  <div>
                    <input
                      type="date"
                      className={cn(inputCls, 'h-9')}
                      value={inlineEdit.start}
                      onChange={(e) =>
                        setInlineEdit((prev) =>
                          prev && prev.id === r.id
                            ? { ...prev, start: e.target.value }
                            : prev,
                        )
                      }
                    />
                  </div>
                  <span className="text-muted-foreground">—</span>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      className="h-8 bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
                      disabled={isSaving}
                      onClick={onSaveInline}
                    >
                      {isSaving ? 'Saving...' : 'Save rate'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 border-border px-3 text-xs"
                      disabled={isSaving}
                      onClick={onCancelEdit}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="tabular-nums text-foreground">
                      ${hourly.toFixed(2)}
                    </span>
                    {r.isCurrent ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        Current
                      </span>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground">
                    {startLabel}
                  </span>
                  <span className="text-muted-foreground">
                    {displayEndLabel(r)}
                  </span>
                  <div className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 border-border px-2 text-xs text-destructive"
                      onClick={() => onDelete(r.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

