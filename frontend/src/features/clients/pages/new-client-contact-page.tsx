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
      setFormError('Please enter first and last name.')
      return
    }
    if (!email.trim()) {
      setFormError('Please enter an email address.')
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
            String((msg as { message: string }).message) ||
              'Save failed. Please try again.',
          )
        } else {
          setFormError(err.message || 'Save failed. Please try again.')
        }
      } else {
        setFormError('Network error. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (error || !client) {
    const message =
      error instanceof ApiError && error.status === 404
        ? 'Client not found.'
        : 'Could not load client.'
    return <p className="text-sm text-destructive">{message}</p>
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Link to="/clients" className="text-foreground hover:underline">
          Clients
        </Link>
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        New contact for {client.name}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        We won’t email this person automatically. The email is stored for your
        records and for invoicing this client.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-0">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-[minmax(140px,200px)_1fr] sm:items-center">
          <label className="text-sm font-medium text-foreground" htmlFor="c-first">
            First name
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
            Last name
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
            Email
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
            Title
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
            Office phone
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
            Mobile
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
            Fax
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
            {submitting ? 'Saving…' : 'Save contact'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
