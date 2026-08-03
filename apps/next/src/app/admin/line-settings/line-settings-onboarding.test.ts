import { describe, expect, it } from 'vitest'

import { getLineWebhookUrl, getRuleTargetHealth } from './line-settings-onboarding'

describe('LINE settings onboarding helpers', () => {
  it('builds the exact webhook URL from the public app origin', () => {
    expect(getLineWebhookUrl('https://ns-erp.vercel.app/')).toBe('https://ns-erp.vercel.app/api/line/webhook')
    expect(getLineWebhookUrl('https://ns-erp.vercel.app/admin/line-settings')).toBe('https://ns-erp.vercel.app/api/line/webhook')
  })

  it('does not produce a webhook URL from an invalid or non-web origin', () => {
    expect(getLineWebhookUrl('')).toBeNull()
    expect(getLineWebhookUrl('not a url')).toBeNull()
    expect(getLineWebhookUrl('http://ns-erp.vercel.app')).toBeNull()
    expect(getLineWebhookUrl('ftp://ns-erp.vercel.app')).toBeNull()
  })

  it('distinguishes usable, inactive, and missing rule targets', () => {
    const targets = [
      { target_id: 'active', is_active: true },
      { target_id: 'old', is_active: false },
    ]

    expect(getRuleTargetHealth('active', targets)).toBe('active')
    expect(getRuleTargetHealth('old', targets)).toBe('inactive')
    expect(getRuleTargetHealth('missing', targets)).toBe('missing')
  })
})
