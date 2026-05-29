import { prisma } from './src/lib/server/prisma'
import { reconcilePoBuys } from './src/lib/server/po-buy-reconciliation'

async function main() {
  const rows = await prisma.po_buys.findMany({ select: { id: true }, take: 3 })
  console.log(rows)
  await prisma.$transaction(async (tx) => {
    await reconcilePoBuys(tx, rows.map((row) => row.id), { actor: 'debug' })
  })
  console.log('ok')
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
