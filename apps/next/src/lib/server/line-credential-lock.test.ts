import { describe, expect, it, vi } from 'vitest'

import {
  acquireLineCredentialReadLock,
  acquireLineCredentialWriteLock,
} from './line-credential-lock'

describe('LINE credential advisory lock', () => {
  it('uses a shared transaction lock while dispatching LINE notifications', async () => {
    const executeRaw = vi.fn().mockResolvedValue(0)

    await acquireLineCredentialReadLock({ $executeRaw: executeRaw } as never)

    expect(executeRaw).toHaveBeenCalledOnce()
    const [sql, key] = executeRaw.mock.calls[0]!
    expect(Array.from(sql as TemplateStringsArray).join('?')).toContain(
      'pg_advisory_xact_lock_shared(hashtext(?))'
    )
    expect(key).toBe('ns-erp:line-credentials')
  })

  it('uses an exclusive transaction lock while switching LINE credentials', async () => {
    const executeRaw = vi.fn().mockResolvedValue(0)

    await acquireLineCredentialWriteLock({ $executeRaw: executeRaw } as never)

    expect(executeRaw).toHaveBeenCalledOnce()
    const [sql, key] = executeRaw.mock.calls[0]!
    expect(Array.from(sql as TemplateStringsArray).join('?')).toContain(
      'pg_advisory_xact_lock(hashtext(?))'
    )
    expect(key).toBe('ns-erp:line-credentials')
  })
})
