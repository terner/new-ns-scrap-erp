import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  acquireReadLock: vi.fn(),
  fetch: vi.fn(),
  findSetting: vi.fn(),
  findTargets: vi.fn(),
  transaction: vi.fn(),
  updateTarget: vi.fn(),
}))

vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    system_settings: { findUnique: mocks.findSetting },
    line_targets: {
      findMany: mocks.findTargets,
      update: mocks.updateTarget,
    },
  },
}))

vi.mock('./line-credential-lock', () => ({
  acquireLineCredentialReadLock: mocks.acquireReadLock,
}))

import { fetchLineBotInfo, syncLineTargetsFromAPI } from './line-target-sync'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('syncLineTargetsFromAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mocks.fetch)
    mocks.transaction.mockImplementation((callback: (transaction: unknown) => unknown) => callback({
      system_settings: { findUnique: mocks.findSetting },
      line_targets: {
        findMany: mocks.findTargets,
        update: mocks.updateTarget,
      },
    }))
    mocks.findSetting.mockResolvedValue({ value: 'new-oa-token' })
    mocks.fetch.mockResolvedValue(Response.json({
      basicId: '@currentoa',
      displayName: 'Current OA',
    }))
    mocks.findTargets.mockResolvedValue([{
      id: 1n,
      target_id: 'R-old-oa-room',
      target_type: 'room',
    }])
  })

  it('does not reactivate an old room because LINE has no room-summary membership check', async () => {
    const result = await syncLineTargetsFromAPI('new-oa-token')

    expect(result).toMatchObject({ failed: 0, refreshed: 0, total: 1, waitingForEvent: 1 })
    expect(mocks.updateTarget).not.toHaveBeenCalled()
  })

  it('reactivates a parked group only after the current OA proves access through LINE', async () => {
    mocks.findTargets.mockResolvedValue([{
      id: 2n,
      is_active: false,
      last_event_type: 'credentials_changed',
      target_id: 'C-known-group',
      target_type: 'group',
    }])
    mocks.fetch
      .mockResolvedValueOnce(Response.json({ basicId: '@currentoa', displayName: 'Current OA' }))
      .mockResolvedValueOnce(Response.json({ groupName: 'Known group' }))

    const result = await syncLineTargetsFromAPI('new-oa-token')

    expect(result).toMatchObject({ failed: 0, refreshed: 1, total: 1 })
    expect(mocks.updateTarget).toHaveBeenCalledWith({
      where: { id: 2n },
      data: expect.objectContaining({
        display_name: 'Known group',
        is_active: true,
        last_event_type: 'sync',
      }),
    })
  })

  it('reactivates a parked user only after the current OA can read that LINE profile', async () => {
    mocks.findTargets.mockResolvedValue([{
      id: 3n,
      is_active: false,
      last_event_type: 'credentials_changed',
      target_id: 'U-known-user',
      target_type: 'user',
    }])
    mocks.fetch
      .mockResolvedValueOnce(Response.json({ basicId: '@currentoa', displayName: 'Current OA' }))
      .mockResolvedValueOnce(Response.json({ displayName: 'Known user' }))

    const result = await syncLineTargetsFromAPI('new-oa-token')

    expect(result).toMatchObject({ failed: 0, refreshed: 1, total: 1 })
    expect(mocks.updateTarget).toHaveBeenCalledWith({
      where: { id: 3n },
      data: expect.objectContaining({
        display_name: 'Known user',
        is_active: true,
        last_event_type: 'sync',
      }),
    })
  })

  it('does not mutate targets when credentials changed after the submitted sync snapshot', async () => {
    mocks.findSetting.mockResolvedValue({ value: 'current-oa-token' })

    await expect(syncLineTargetsFromAPI('old-oa-token')).rejects.toThrow(
      'ข้อมูล LINE ถูกเปลี่ยนระหว่างซิงค์ กรุณาโหลดการตั้งค่าใหม่แล้วลองอีกครั้ง',
    )

    expect(mocks.acquireReadLock).toHaveBeenCalledTimes(1)
    expect(mocks.acquireReadLock.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.findSetting.mock.invocationCallOrder[0],
    )
    expect(mocks.findTargets).not.toHaveBeenCalled()
    expect(mocks.updateTarget).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('reports a failed bot-info request by status without reading its response body', async () => {
    const responseText = vi.fn().mockResolvedValue('Authorization: Bearer fake-token-from-line')
    mocks.fetch.mockResolvedValue({
      ok: false,
      status: 502,
      text: responseText,
    })

    await expect(fetchLineBotInfo('submitted-token')).rejects.toThrow('502')
    await expect(fetchLineBotInfo('submitted-token')).rejects.not.toThrow('fake-token-from-line')
    expect(responseText).not.toHaveBeenCalled()
  })

  it('normalizes a malformed successful bot-info response without exposing its body', async () => {
    mocks.fetch.mockResolvedValue(Response.json({
      displayName: 'Authorization: Bearer fake-token-in-body',
    }))

    const error = await fetchLineBotInfo('submitted-token').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(Error)
    if (!(error instanceof Error)) throw new Error('Expected fetchLineBotInfo to reject')
    expect(error.message).toBe('ข้อมูลตอบกลับจาก LINE OA ไม่ถูกต้อง')
    expect(error.message).not.toContain('fake-token-in-body')
  })

  it('normalizes a bot-info network rejection without exposing request credentials', async () => {
    mocks.fetch.mockRejectedValue(new Error('Authorization: Bearer fake-network-token'))

    const error = await fetchLineBotInfo('submitted-token').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(Error)
    if (!(error instanceof Error)) throw new Error('Expected fetchLineBotInfo to reject')
    expect(error.message).toBe('เชื่อมต่อ LINE OA ไม่สำเร็จ (NETWORK_ERROR)')
    expect(error.message).not.toContain('fake-network-token')
  })

  it('treats a malformed successful target summary as a safe failed refresh', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.findSetting.mockResolvedValue({ value: 'submitted-token' })
    mocks.findTargets.mockResolvedValue([{
      id: 2n,
      target_id: 'C-current-group',
      target_type: 'group',
    }])
    mocks.fetch
      .mockResolvedValueOnce(Response.json({ basicId: '@currentoa', displayName: 'Current OA' }))
      .mockResolvedValueOnce(new Response('Authorization: Bearer fake-summary-token', { status: 200 }))

    const result = await syncLineTargetsFromAPI('submitted-token')

    expect(result).toMatchObject({ failed: 1, refreshed: 0, total: 1 })
    expect(mocks.updateTarget).not.toHaveBeenCalled()
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('fake-summary-token')
  })

  it('logs only a fixed message when bot-info lookup fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.findSetting.mockResolvedValue({ value: 'submitted-token' })
    mocks.fetch.mockRejectedValue(new Error('Authorization: Bearer fake-log-token'))

    const result = await syncLineTargetsFromAPI('submitted-token')

    expect(result.bot).toBeNull()
    expect(consoleError).toHaveBeenCalledWith('[line-target-sync] fetch bot info failed')
    expect(consoleError.mock.calls).toEqual([['[line-target-sync] fetch bot info failed']])
  })

  it('treats a target-summary network rejection as a safe failed refresh', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.findSetting.mockResolvedValue({ value: 'submitted-token' })
    mocks.findTargets.mockResolvedValue([{
      id: 3n,
      target_id: 'C-current-group',
      target_type: 'group',
    }])
    mocks.fetch
      .mockResolvedValueOnce(Response.json({ basicId: '@currentoa', displayName: 'Current OA' }))
      .mockRejectedValueOnce(new Error('Authorization: Bearer fake-target-network-token'))

    const result = await syncLineTargetsFromAPI('submitted-token')

    expect(result).toMatchObject({ failed: 1, refreshed: 0, total: 1 })
    expect(JSON.stringify(result)).not.toContain('fake-target-network-token')
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('fake-target-network-token')
  })
})
