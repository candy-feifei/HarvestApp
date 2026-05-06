/**
 * Pause between steps when recording: set `E2E_STEP_DELAY_MS` (milliseconds), e.g. `800`.
 * `npm run test:e2e:journey:record` sets this via `--record` by default (overridable by env).
 */
export async function e2eStepPause(): Promise<void> {
  const raw = process.env.E2E_STEP_DELAY_MS
  if (raw == null || raw === '') {
    return
  }
  const ms = Number(raw)
  if (!Number.isFinite(ms) || ms <= 0) {
    return
  }
  await new Promise((r) => setTimeout(r, ms))
}
