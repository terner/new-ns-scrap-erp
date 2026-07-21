import { describe, expect, it } from 'vitest'

import { permissionForPath } from './navigation'

describe('weight ticket working-draft route access', () => {
  it('does not fall through to the generic daily finance permission', () => {
    expect(permissionForPath('/api/daily/weight-ticket-form-drafts')).toBe('daily.weight_tickets.view')
  })
})
