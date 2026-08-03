type RuleTarget = {
  target_id: string
  is_active: boolean
}

export function getLineWebhookUrl(appUrl: string | null | undefined): string | null {
  if (!appUrl?.trim()) return null

  try {
    const url = new URL(appUrl.trim())
    if (url.protocol !== 'https:') return null
    return `${url.origin}/api/line/webhook`
  } catch {
    return null
  }
}

export function getRuleTargetHealth(targetId: string, targets: RuleTarget[]): 'active' | 'inactive' | 'missing' {
  const target = targets.find((item) => item.target_id === targetId)
  if (!target) return 'missing'
  return target.is_active ? 'active' : 'inactive'
}
