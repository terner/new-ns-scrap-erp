import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findRules: vi.fn(),
  findSetting: vi.fn(),
  findTargets: vi.fn(),
}))

vi.mock('./prisma', () => ({
  prisma: {
    line_notification_rules: { findMany: db.findRules },
    line_targets: { findMany: db.findTargets },
    system_settings: { findUnique: db.findSetting },
  },
}))

import {
  matchesLineNotificationRule,
  resolveLineTargetsForDocument,
  ruleExplicitlyIncludesDocumentType,
} from './line-notification-routing'

describe('financial LINE document routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.findSetting.mockResolvedValue(null)
  })

  it('requires an explicit PB or SB document type on a financial rule', () => {
    const purchaseBill = { type: 'PB' }
    const genericRule = { conditions: {} }
    const purchaseRule = { conditions: { documentTypes: ['PB'] } }
    const salesRule = { conditions: { documentTypes: ['SB'] } }

    expect(matchesLineNotificationRule(purchaseBill, genericRule)).toBe(true)
    expect(ruleExplicitlyIncludesDocumentType(genericRule, purchaseBill.type)).toBe(false)
    expect(ruleExplicitlyIncludesDocumentType(purchaseRule, purchaseBill.type)).toBe(true)
    expect(ruleExplicitlyIncludesDocumentType(salesRule, purchaseBill.type)).toBe(false)
  })

  it('does not use a generic rule or default target for PB', async () => {
    db.findRules.mockResolvedValue([{
      conditions: {},
      id: 1n,
      name: 'generic rule',
      priority: 1,
      stop_after_match: false,
      target_id: 'C-GENERIC',
    }])
    db.findTargets.mockResolvedValue([{
      display_name: 'generic group',
      is_active: true,
      is_default: true,
      target_id: 'C-GENERIC',
      target_type: 'group',
    }])

    await expect(resolveLineTargetsForDocument({ type: 'PB' }, { allowFallback: false })).resolves.toEqual([])
    expect(db.findSetting).not.toHaveBeenCalled()
  })

  it('routes PB only to its explicit target', async () => {
    db.findRules.mockResolvedValue([{
      conditions: { documentTypes: ['PB'] },
      id: 2n,
      name: 'purchase bills',
      priority: 1,
      stop_after_match: true,
      target_id: 'C-PB',
    }])
    db.findTargets.mockResolvedValue([{
      display_name: 'purchase bill group',
      is_active: true,
      is_default: false,
      target_id: 'C-PB',
      target_type: 'group',
    }])

    const decisions = await resolveLineTargetsForDocument({ type: 'PB' }, { allowFallback: false })

    expect(decisions).toHaveLength(1)
    expect(decisions[0]?.targetId).toBe('C-PB')
  })
})
