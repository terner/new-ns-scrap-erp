import { redirect } from 'next/navigation'
import { getCurrentAuthContext } from '@/lib/server/auth-context'
import { Card } from '@/components/ui/Card'

const nextSteps = [
  'กำหนด route protection และ permission guard ให้แต่ละ module',
  'กำหนด shared service contract กับ Supabase dev-target',
  'เลือกว่าจะ migrate route ไหนจาก Vue มาเป็น Next.js ก่อน',
]

export default async function HomePage() {
  let landingPath: string | null = null

  try {
    const authContext = await getCurrentAuthContext()
    const roleCodes = (authContext?.roles ?? [])
      .map((r) => String(r.code ?? '').toLowerCase())
      .filter(Boolean)

    if (roleCodes.includes('admin') || roleCodes.includes('owner')) {
      landingPath = '/owner-daily'
    } else if (roleCodes.includes('production_department')) {
      landingPath = '/production/dashboard'
    } else if (roleCodes.includes('sorting_department')) {
      landingPath = '/daily/weight-ticket-list'
    }
  } catch {
    // Ignore auth error, let it render normal HomePage or be redirected by middleware
  }

  if (landingPath) {
    redirect(landingPath)
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-scrap-accent">Next.js workspace</p>
        <h1 className="mt-1 text-2xl font-bold text-scrap-ink">NS Scrap ERP</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {nextSteps.map((step, index) => (
          <Card key={step}>
            <div className="text-xs font-bold text-scrap-accent">Step {index + 1}</div>
            <div className="mt-2 text-sm font-semibold text-scrap-ink">{step}</div>
          </Card>
        ))}
      </div>
    </section>
  )
}
