import type { Prisma } from '../../../generated/prisma/client'

const LINE_CREDENTIAL_LOCK_KEY = 'ns-erp:line-credentials'

type AdvisoryLockClient = Pick<Prisma.TransactionClient, '$executeRaw'>

export async function acquireLineCredentialReadLock(
  transaction: AdvisoryLockClient,
): Promise<void> {
  await transaction.$executeRaw`
    select pg_advisory_xact_lock_shared(hashtext(${LINE_CREDENTIAL_LOCK_KEY}))
  `
}

export async function acquireLineCredentialWriteLock(
  transaction: AdvisoryLockClient,
): Promise<void> {
  await transaction.$executeRaw`
    select pg_advisory_xact_lock(hashtext(${LINE_CREDENTIAL_LOCK_KEY}))
  `
}
