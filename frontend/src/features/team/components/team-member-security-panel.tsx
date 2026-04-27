import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { changePasswordRequest } from '@/features/auth/api'
import { setTeamMemberPassword } from '@/features/team/api'
import { Button } from '@/components/ui/button'
import {
  fieldWrap,
  inputCls,
  labelCls,
} from '@/features/clients/client-form-helpers'

type Props = {
  firstName: string
  memberId: string
  isViewingSelf: boolean
  canSetOtherPassword: boolean
}

export function TeamMemberSecurityPanel({
  firstName,
  memberId,
  isViewingSelf,
  canSetOtherPassword,
}: Props) {
  const qc = useQueryClient()
  const [selfCurrent, setSelfCurrent] = useState('')
  const [selfNew, setSelfNew] = useState('')
  const [selfConfirm, setSelfConfirm] = useState('')
  const [selfErr, setSelfErr] = useState<string | null>(null)

  const [otherNew, setOtherNew] = useState('')
  const [otherConfirm, setOtherConfirm] = useState('')
  const [otherErr, setOtherErr] = useState<string | null>(null)

  const selfMut = useMutation({
    mutationFn: () =>
      changePasswordRequest({
        currentPassword: selfCurrent,
        newPassword: selfNew,
      }),
    onSuccess: async () => {
      setSelfCurrent('')
      setSelfNew('')
      setSelfConfirm('')
      setSelfErr(null)
      await qc.invalidateQueries({ queryKey: ['team', 'member', memberId] })
    },
    onError: (e: Error) => {
      setSelfErr(e.message || 'Could not change password')
    },
  })

  const otherMut = useMutation({
    mutationFn: () => setTeamMemberPassword(memberId, { newPassword: otherNew }),
    onSuccess: async () => {
      setOtherNew('')
      setOtherConfirm('')
      setOtherErr(null)
      await qc.invalidateQueries({ queryKey: ['team', 'member', memberId] })
    },
    onError: (e: Error) => {
      setOtherErr(e.message || 'Could not set password')
    },
  })

  function onSelfSubmit(e: FormEvent) {
    e.preventDefault()
    setSelfErr(null)
    if (selfNew.length < 8) {
      setSelfErr('New password must be at least 8 characters.')
      return
    }
    if (selfNew !== selfConfirm) {
      setSelfErr('New password and confirmation do not match.')
      return
    }
    selfMut.mutate()
  }

  function onOtherSubmit(e: FormEvent) {
    e.preventDefault()
    setOtherErr(null)
    if (otherNew.length < 8) {
      setOtherErr('Password must be at least 8 characters.')
      return
    }
    if (otherNew !== otherConfirm) {
      setOtherErr('Password and confirmation do not match.')
      return
    }
    if (
      !window.confirm(
        `Set a new sign-in password for ${firstName}? They will use this with their work email to log in.`,
      )
    ) {
      return
    }
    otherMut.mutate()
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {firstName}&apos;s security
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign-in password is used with this person&apos;s work email to access
        this account.
      </p>

      {isViewingSelf ? (
        <form onSubmit={onSelfSubmit} className="mt-6 max-w-md space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            Change password
          </h2>
          <div className={fieldWrap}>
            <label className={labelCls} htmlFor="sec-cur">
              Current password
            </label>
            <input
              id="sec-cur"
              type="password"
              className={inputCls}
              autoComplete="current-password"
              value={selfCurrent}
              onChange={(e) => setSelfCurrent(e.target.value)}
              required
            />
          </div>
          <div className={fieldWrap}>
            <label className={labelCls} htmlFor="sec-new">
              New password
            </label>
            <input
              id="sec-new"
              type="password"
              className={inputCls}
              autoComplete="new-password"
              value={selfNew}
              onChange={(e) => setSelfNew(e.target.value)}
              minLength={8}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          </div>
          <div className={fieldWrap}>
            <label className={labelCls} htmlFor="sec-confirm">
              Confirm new password
            </label>
            <input
              id="sec-confirm"
              type="password"
              className={inputCls}
              autoComplete="new-password"
              value={selfConfirm}
              onChange={(e) => setSelfConfirm(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {selfErr ? (
            <p className="text-sm text-destructive" role="alert">
              {selfErr}
            </p>
          ) : null}
          <div className="pt-1">
            <Button
              type="submit"
              className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={selfMut.isPending}
            >
              {selfMut.isPending ? 'Saving…' : 'Update password'}
            </Button>
          </div>
        </form>
      ) : canSetOtherPassword ? (
        <form onSubmit={onOtherSubmit} className="mt-6 max-w-md space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            Set new password
          </h2>
          <p className="text-sm text-muted-foreground">
            As an administrator, you can set a new password for this
            person&apos;s account. Share it with them through a secure channel.
          </p>
          <div className={fieldWrap}>
            <label className={labelCls} htmlFor="sec-o-new">
              New password
            </label>
            <input
              id="sec-o-new"
              type="password"
              className={inputCls}
              autoComplete="new-password"
              value={otherNew}
              onChange={(e) => setOtherNew(e.target.value)}
              minLength={8}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          </div>
          <div className={fieldWrap}>
            <label className={labelCls} htmlFor="sec-o-confirm">
              Confirm new password
            </label>
            <input
              id="sec-o-confirm"
              type="password"
              className={inputCls}
              autoComplete="new-password"
              value={otherConfirm}
              onChange={(e) => setOtherConfirm(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {otherErr ? (
            <p className="text-sm text-destructive" role="alert">
              {otherErr}
            </p>
          ) : null}
          <div className="pt-1">
            <Button
              type="submit"
              className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={otherMut.isPending}
            >
              {otherMut.isPending ? 'Saving…' : 'Set password'}
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Only account administrators can set or change another person&apos;s
          sign-in password. You can use{' '}
          <strong>Basic info</strong> to resend the invitation, or ask an
          administrator to update the password on this page.
        </p>
      )}
    </div>
  )
}
