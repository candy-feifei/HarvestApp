import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onClose: () => void
  onCancel: () => void
  onRestart: () => void
  onStartOnToday: () => void
  className?: string
}

export function StartTimerConfirm({
  open,
  onClose,
  onCancel,
  onRestart,
  onStartOnToday,
  className,
}: Props) {
  if (!open) {
    return null
  }
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={cn(
          'absolute right-0 top-full z-50 mt-1 w-[min(100%,320px)] rounded-md border border-border bg-white p-3 text-left text-sm text-foreground shadow-md',
          className,
        )}
        role="dialog"
      >
        <p className="mb-3 text-muted-foreground">
          This is not today&apos;s timesheet. Are you sure you want to restart the timer?
        </p>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="w-full justify-center bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={onRestart}>
            Yes, restart
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={onStartOnToday}>
            Start on today
          </Button>
        </div>
      </div>
    </>
  )
}
