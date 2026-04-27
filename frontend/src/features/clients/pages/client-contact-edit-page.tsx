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
  fetchClient,
  fetchClientContact,
  updateClientContact,
  type ClientContactDetail,
} from '@/features/clients/api'

type FormProps = {
  clientName: string
  clientId: string
  contactId: string
  initial: ClientContactDetail
}

function ClientContactForm({
  clientName,
  clientId,
  contactId,
  initial,
}: FormProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState(initial.firstName)
  const [lastName, setLastName] = useState(initial.lastName)
  const [email, setEmail] = useState(initial.email)
  const [title, setTitle] = useState(initial.title ?? '')
  const [officeNumber, setOfficeNumber] = useState(initial.officeNumber ?? '')
  const [mobileNumber, setMobileNumber] = useState(initial.mobileNumber ?? '')
  const [faxNumber, setFaxNumber] = useState(initial.faxNumber ?? '')

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
      await updateClientContact(clientId, contactId, {
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
      await queryClient.invalidateQueries({
        queryKey: ['client', clientId, 'contact', contactId],
      })
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

  return (
    <>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        Edit contact — {clientName}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        We won’t send email automatically. Use this for your records and invoicing.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-0">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-[minmax(140px,200px)_1fr] sm:items-center">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="ec-first"
          >
            First name
          </label>
          <div className={fieldWrap}>
            <input
              id="ec-first"
              className={inputCls}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={100}
              required
            />
          </div>

          <label
            className="text-sm font-medium text-foreground"
            htmlFor="ec-last"
          >
            Last name
          </label>
          <div className={fieldWrap}>
            <input
              id="ec-last"
              className={inputCls}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={100}
              required
            />
          </div>

          <label
            className="text-sm font-medium text-foreground"
            htmlFor="ec-email"
          >
            Email
          </label>
          <div className={fieldWrap}>
            <input
              id="ec-email"
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
          <label className={labelCls} htmlFor="ec-title">
            Title
          </label>
          <div className={fieldWrap}>
            <input
              id="ec-title"
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          <label className={labelCls} htmlFor="ec-office">
            Office phone
          </label>
          <div className={fieldWrap}>
            <input
              id="ec-office"
              className={inputCls}
              value={officeNumber}
              onChange={(e) => setOfficeNumber(e.target.value)}
              inputMode="tel"
              maxLength={64}
            />
          </div>

          <label className={labelCls} htmlFor="ec-mobile">
            Mobile
          </label>
          <div className={fieldWrap}>
            <input
              id="ec-mobile"
              className={inputCls}
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              inputMode="tel"
              maxLength={64}
            />
          </div>

          <label className={labelCls} htmlFor="ec-fax">
            Fax
          </label>
          <div className={fieldWrap}>
            <input
              id="ec-fax"
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
    </>
  )
}

export function ClientContactEditPage() {
  const { clientId = '', contactId = '' } = useParams()
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => fetchClient(clientId),
    enabled: Boolean(clientId),
  })
  const {
    data: contact,
    isLoading: contactLoading,
    error: contactError,
  } = useQuery({
    queryKey: ['client', clientId, 'contact', contactId],
    queryFn: () => fetchClientContact(clientId, contactId),
    enabled: Boolean(clientId && contactId),
  })

  if (clientLoading || !client || contactLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (contactError || !contact) {
    const message =
      contactError instanceof ApiError && contactError.status === 404
        ? 'Contact not found.'
        : 'Could not load contact.'
    return <p className="text-sm text-destructive">{message}</p>
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Link to="/clients" className="text-foreground hover:underline">
          Clients
        </Link>
      </p>
      <ClientContactForm
        key={contactId}
        clientName={client.name}
        clientId={clientId}
        contactId={contactId}
        initial={contact}
      />
    </div>
  )
}
