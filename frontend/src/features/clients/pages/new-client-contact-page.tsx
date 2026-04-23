import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '@/lib/api/http'
import { Button } from '@/components/ui/button'
import {
  fieldWrap,
  inputCls,
  labelCls,
} from '@/features/clients/client-form-helpers'
import {
  createClientContact,
  fetchClient,
} from '@/features/clients/api'

export function NewClientContactPage() {
  const { clientId = '' } = useParams()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: client, isLoading, error } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => fetchClient(clientId),
    enabled: Boolean(clientId),
  })

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [officeNumber, setOfficeNumber] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [faxNumber, setFaxNumber] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!firstName.trim() || !lastName.trim()) {
      setFormError('请填写名与姓。')
      return
    }
    if (!email.trim()) {
      setFormError('请填写邮箱。')
      return
    }
    setSubmitting(true)
    try {
      await createClientContact(clientId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        title: title.trim() || undefined,
        officeNumber: officeNumber.trim() || undefined,
        mobileNumber: mobileNumber.trim() || undefined,
        faxNumber: faxNumber.trim() || undefined,
      })
      await queryClient.invalidateQueries({ queryKey: ['clients'] })
      await queryClient.invalidateQueries({ queryKey: ['client', clientId] })
      navigate('/clients', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        const msg = err.body
        if (typeof msg === 'object' && msg && 'message' in msg) {
          setFormError(
            String((msg as { message: string }).message) || '保存失败，请重试。',
          )
        } else {
          setFormError(err.message || '保存失败，请重试。')
        }
      } else {
        setFormError('网络错误，请重试。')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">加载中…</p>
  }

  if (error || !client) {
    const message =
      error instanceof ApiError && error.status === 404
        ? '未找到该客户。'
        : '无法加载客户信息。'
    return <p className="text-sm text-destructive">{message}</p>
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Link to="/clients" className="text-foreground hover:underline">
          客户
        </Link>
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        为 {client.name} 添加新联系人
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        添加联系人不会自动发送邮件。邮箱仅作您自己的记录，并便于以后在系统内直接向该客户发送发票。
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-0">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-[minmax(140px,200px)_1fr] sm:items-center">
          <label className="text-sm font-medium text-foreground" htmlFor="c-first">
            名
          </label>
          <div className={fieldWrap}>
            <input
              id="c-first"
              className={inputCls}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={100}
              required
            />
          </div>

          <label className="text-sm font-medium text-foreground" htmlFor="c-last">
            姓
          </label>
          <div className={fieldWrap}>
            <input
              id="c-last"
              className={inputCls}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={100}
              required
            />
          </div>

          <label className="text-sm font-medium text-foreground" htmlFor="c-email">
            邮箱
          </label>
          <div className={fieldWrap}>
            <input
              id="c-email"
              type="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
        </div>

        <hr className="my-6 border-border" />

        <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-[minmax(140px,200px)_1fr] sm:items-center">
          <label className={labelCls} htmlFor="c-title">
            职位
          </label>
          <div className={fieldWrap}>
            <input
              id="c-title"
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          <label className={labelCls} htmlFor="c-office">
            办公电话
          </label>
          <div className={fieldWrap}>
            <input
              id="c-office"
              className={inputCls}
              value={officeNumber}
              onChange={(e) => setOfficeNumber(e.target.value)}
              inputMode="tel"
              maxLength={64}
            />
          </div>

          <label className={labelCls} htmlFor="c-mobile">
            手机
          </label>
          <div className={fieldWrap}>
            <input
              id="c-mobile"
              className={inputCls}
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              inputMode="tel"
              maxLength={64}
            />
          </div>

          <label className={labelCls} htmlFor="c-fax">
            传真
          </label>
          <div className={fieldWrap}>
            <input
              id="c-fax"
              className={inputCls}
              value={faxNumber}
              onChange={(e) => setFaxNumber(e.target.value)}
              inputMode="tel"
              maxLength={64}
            />
          </div>
        </div>

        {formError && (
          <p className="mt-6 text-sm text-destructive" role="alert">
            {formError}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={submitting}
            className="h-10 min-w-[120px] px-5 shadow-sm"
          >
            {submitting ? '保存中…' : '保存联系人'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => navigate(-1)}
          >
            取消
          </Button>
        </div>
      </form>
    </div>
  )
}
