import type { ZodIssue } from 'zod'

export function errorKeyFromPath(path: Array<string | number>) {
  return path.map(String).join('.')
}

export function issueMapFromZodIssues(issues: ZodIssue[]) {
  const map: Record<string, string> = {}
  for (const issue of issues) {
    const key = errorKeyFromPath(issue.path)
    if (!key || map[key]) continue
    map[key] = issue.message
  }
  return map
}

export function firstErrorKeyFromZodIssues(issues: ZodIssue[]) {
  for (const issue of issues) {
    const key = errorKeyFromPath(issue.path)
    if (key) return key
  }
  return null
}

export function focusFieldError(errorKey: string | null | undefined) {
  if (typeof window === 'undefined' || !errorKey) return

  window.requestAnimationFrame(() => {
    const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(errorKey) : errorKey.replace(/"/g, '\\"')
    const root = document.querySelector<HTMLElement>(`[data-error-key="${escaped}"]`)
    if (!root) return

    root.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    const focusTarget = (
      root.matches('input, select, textarea, button, [tabindex]') ? root : root.querySelector<HTMLElement>('input, select, textarea, button, [tabindex]')
    )
    focusTarget?.focus()
  })
}
