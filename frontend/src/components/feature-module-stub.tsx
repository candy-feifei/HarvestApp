import { getAppNavItem } from '@/lib/nav-config'

type FeatureModuleStubProps = {
  navId: string
}

/** Placeholder route until the feature module ships. */
export function FeatureModuleStub({ navId }: FeatureModuleStubProps) {
  const meta = getAppNavItem(navId)
  if (!meta) return null

  return (
    <div className="mx-auto max-w-3xl space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
      <p className="text-sm text-muted-foreground">Coming soon.</p>
    </div>
  )
}
