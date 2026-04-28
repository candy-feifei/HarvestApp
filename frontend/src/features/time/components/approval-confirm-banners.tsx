import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** 文案完整显示（不截断）；宽屏时与按钮同一行，窄屏时纵向堆叠 */
const bannerClass = cn(
  'flex w-full min-w-0 max-w-full flex-col gap-3 rounded-lg border px-3 py-2.5 sm:min-w-[min(100%,36rem)] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4 sm:py-3',
)

type SubmitWeekConfirmBannerProps = {
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  resubmit?: boolean
  className?: string
}

export function SubmitWeekConfirmBanner({
  onConfirm,
  onCancel,
  loading,
  resubmit = false,
  className,
}: SubmitWeekConfirmBannerProps) {
  return (
    <div
      className={cn(
        bannerClass,
        'border-orange-200/90 bg-orange-50/90 dark:border-orange-900/50 dark:bg-orange-950/25',
        className,
      )}
      role="region"
      aria-label="Confirm submit for approval"
    >
      <p className="w-full min-w-0 flex-1 break-words text-sm font-medium leading-normal text-foreground sm:pr-2">
        {resubmit
          ? "Resubmit this week's timesheet for approval?"
          : "Submit this week's timesheet for approval?"}
      </p>
      <div className="flex w-full shrink-0 flex-nowrap items-center justify-end gap-2 sm:w-auto sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="shrink-0 border-border bg-white"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
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
  className?: string
}

export function WithdrawWeekConfirmBanner({
  onConfirm,
  onCancel,
  loading,
  className,
}: WithdrawWeekConfirmBannerProps) {
  return (
    <div
      className={cn(
        bannerClass,
        'border-orange-200/90 bg-[#fff5f0] dark:border-orange-900/50 dark:bg-orange-950/30',
        className,
      )}
      role="region"
      aria-label="Confirm withdraw approval"
    >
      <p className="w-full min-w-0 flex-1 break-words text-sm font-medium leading-normal text-foreground sm:pr-2">
        This will unlock the entire timesheet.
      </p>
      <div className="flex w-full shrink-0 flex-nowrap items-center justify-end gap-2 sm:w-auto sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="shrink-0 border-border bg-white"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="shrink-0 bg-destructive text-white hover:bg-destructive/90"
          onClick={onConfirm}
          disabled={loading}
        >
          Yes, unlock timesheet
        </Button>
      </div>
    </div>
  )
}
