import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const bannerClass =
  'flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4'

type SubmitWeekConfirmBannerProps = {
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  resubmit?: boolean
}

export function SubmitWeekConfirmBanner({
  onConfirm,
  onCancel,
  loading,
  resubmit = false,
}: SubmitWeekConfirmBannerProps) {
  return (
    <div
      className={cn(bannerClass, 'border-orange-200/90 bg-orange-50/90 dark:border-orange-900/50 dark:bg-orange-950/25')}
      role="region"
      aria-label="Confirm submit for approval"
    >
      <p className="text-sm font-medium text-foreground">
        {resubmit
          ? "Resubmit this week's timesheet for approval?"
          : "Submit this week's timesheet for approval?"}
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-border bg-white"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={onConfirm}
          disabled={loading}
        >
          {resubmit ? 'Yes, resubmit timesheet' : 'Yes, submit timesheet'}
        </Button>
      </div>
    </div>
  )
}

type WithdrawWeekConfirmBannerProps = {
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function WithdrawWeekConfirmBanner({ onConfirm, onCancel, loading }: WithdrawWeekConfirmBannerProps) {
  return (
    <div
      className={cn(bannerClass, 'border-orange-200/90 bg-[#fff5f0] dark:border-orange-900/50 dark:bg-orange-950/30')}
      role="region"
      aria-label="Confirm withdraw approval"
    >
      <p className="text-sm font-medium text-foreground">This will unlock the entire timesheet.</p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-border bg-white"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="bg-destructive text-white hover:bg-destructive/90"
          onClick={onConfirm}
          disabled={loading}
        >
          Yes, unlock timesheet
        </Button>
      </div>
    </div>
  )
}
