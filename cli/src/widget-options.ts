// Host-level comments-widget flags, read from the self-hosted container env.
//
// Kept out of worker.tsx so tests do not pull in the whole worker (Stripe,
// Resend, the Durable Object) just to check boolean parsing.

const TRUTHY = new Set(["1", "true", "on", "yes"])
const FALSY = new Set(["0", "false", "off", "no"])

/** Parse a boolean env var. Unset, empty or unrecognised falls back. */
export function boolVar(value: string | undefined, fallback: boolean): boolean {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return fallback
  if (TRUTHY.has(normalized)) return true
  if (FALSY.has(normalized)) return false
  return fallback
}

export interface WidgetOptions {
  webhooks: boolean
}

/**
 * Webhooks default to off: the widget's settings panel can otherwise point at
 * any URL and auto-send annotations to it. `CRITIQUE_WIDGET_WEBHOOKS=on`
 * restores the upstream behaviour.
 */
export function readWidgetOptions(env: { CRITIQUE_WIDGET_WEBHOOKS?: string }): WidgetOptions {
  return {
    webhooks: boolVar(env.CRITIQUE_WIDGET_WEBHOOKS, false),
  }
}
