import { buildMainDashboards, type MainDashboardFilter } from '@/lib/server/main-dashboards'

export async function buildDashboardSummary(filter: MainDashboardFilter) {
  const payload = await buildMainDashboards(filter)
  return {
    analytics: payload.dailyReport.analytics,
    dashboard: payload.dashboard,
    filterOptions: payload.filterOptions,
    filters: payload.filters,
    sourceState: payload.sourceState,
  }
}
