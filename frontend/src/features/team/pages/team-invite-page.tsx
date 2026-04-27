import { useMemo, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '@/lib/api/http'
import { inviteTeamMember, listTeamRoles } from '@/features/team/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  fieldWrap,
  inputCls,
  labelCls,
  selectCls,
} from '@/features/clients/client-form-helpers'

const CAPACITY_OPTIONS = [20, 25, 30, 35, 40, 45, 50, 60] as const

function parseMoney(s: string): number | undefined {
  const t = s.trim()
  if (t === '') return undefined
  const n = Number(t)
  if (Number.isNaN(n) || n < 0) return undefined
  return Math.round(n * 100) / 100
}

export function TeamInvitePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [workEmail, setWorkEmail] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [employmentType, setEmploymentType] = useState<
    'EMPLOYEE' | 'CONTRACTOR'
  >('EMPLOYEE')
  const [jobLabel, setJobLabel] = useState('')
  const [weeklyCapacity, setWeeklyCapacity] = useState(35)
  const [billable, setBillable] = useState('')
  const [cost, setCost] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const teamRolesQ = useQuery({
    queryKey: ['team', 'roles'],
    queryFn: listTeamRoles,
  })

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      const res = await inviteTeamMember({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        workEmail: workEmail.trim(),
        employeeId: employeeId.trim() || undefined,
        employmentType,
        jobLabel: jobLabel.trim() || undefined,
        weeklyCapacity,
        defaultBillableRatePerHour: parseMoney(billable),
        costRatePerHour: parseMoney(cost),
      })
      await queryClient.invalidateQueries({ queryKey: ['team', 'members'] })
      navigate('/team', {
        replace: true,
        state: { invited: true as const, setPasswordUrl: res.setPasswordUrl },
      })
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body
        const msg =
          typeof body === 'object' &&
          body !== null &&
          'message' in body
            ? String((body as { message: unknown }).message)
            : err.message
        setFormError(msg || 'Invitation failed')
        return
      }
      setFormError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg px-3 py-6 sm:px-4">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Invite person
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        We&apos;ll email this person an invitation to join your team. If they
        don&apos;t have a password yet, the message will include a link to set
        one.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        {formError ? (
          <p
            className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {formError}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={fieldWrap}>
            <label className={labelCls} htmlFor="inv-first">
              First name
            </label>
            <input
              id="inv-first"
              className={inputCls}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
            />
          </div>
          <div className={fieldWrap}>
            <label className={labelCls} htmlFor="inv-last">
              Last name
            </label>
            <input
              id="inv-last"
              className={inputCls}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              autoComplete="family-name"
            />
          </div>
        </div>

        <div className={fieldWrap}>
          <label className={labelCls} htmlFor="inv-email">
            Work email
          </label>
          <input
            id="inv-email"
            type="email"
            className={inputCls}
            value={workEmail}
            onChange={(e) => setWorkEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className={fieldWrap}>
          <label className={labelCls} htmlFor="inv-empid">
            Employee ID
          </label>
          <input
            id="inv-empid"
            className={inputCls}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Optional. A unique identifier for this employee within your
            organization.
          </p>
        </div>

        <div className={fieldWrap}>
          <span className={labelCls}>Type</span>
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={() => setEmploymentType('EMPLOYEE')}
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
              onClick={() => setEmploymentType('CONTRACTOR')}
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
          <label className={labelCls} htmlFor="inv-roles">
            Roles
          </label>
          <select
            id="inv-roles"
            className={cn(selectCls, 'max-w-full sm:max-w-md')}
            value={jobLabel}
            onChange={(e) => setJobLabel(e.target.value)}
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
            Optional. Options come from your organization&apos;s role list.{' '}
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
          <label className={labelCls} htmlFor="inv-cap">
            Capacity
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <select
              id="inv-cap"
              className={cn(selectCls, 'max-w-[200px]')}
              value={weeklyCapacity}
              onChange={(e) => setWeeklyCapacity(Number(e.target.value))}
            >
              {CAPACITY_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h}
                  {h === 35 ? ' (default)' : ''}
                </option>
              ))}
            </select>
            <span className="text-sm text-muted-foreground">hours per week</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Optional. The number of hours per week this person is available to
            work.
          </p>
        </div>

        <div className={fieldWrap}>
          <label className={labelCls} htmlFor="inv-bill">
            Default billable rate
          </label>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <input
              id="inv-bill"
              className={inputCls}
              inputMode="decimal"
              value={billable}
              onChange={(e) => setBillable(e.target.value)}
              placeholder="0.00"
            />
            <span className="text-sm text-muted-foreground">per hour</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Optional. The rate you bill clients for this person&apos;s time. You
            can override this rate on each project. Only Administrators and
            Managers with permission can see billable rates and amounts.
          </p>
        </div>

        <div className={fieldWrap}>
          <label className={labelCls} htmlFor="inv-cost">
            Cost rate
          </label>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <input
              id="inv-cost"
              className={inputCls}
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
            />
            <span className="text-sm text-muted-foreground">per hour</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Optional. The internal cost that this person incurs on your
            business. Only Administrators can see cost rates and amounts.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end sm:gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-9 border-border"
            asChild
            disabled={submitting}
          >
            <Link to="/team">Cancel</Link>
          </Button>
          <Button
            type="submit"
            className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={submitting}
          >
            {submitting ? 'Working…' : 'Invite and continue'}
          </Button>
        </div>
      </form>
    </div>
  )
}
