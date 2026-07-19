import { toDateOnly } from '@/lib/server/daily'
import type { DashboardReportFilters } from '@/lib/server/dashboard-report-contracts'

export function parseReportDate(value: string | null, fallback = new Date()) {
  const parsed = value ? new Date(value) : fallback
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

export function reportFilters(date: Date, from?: string | null, to?: string | null): DashboardReportFilters {
  const dateLabel = toDateOnly(date)
  return { date: dateLabel, from: from || dateLabel, to: to || dateLabel }
}

export function noStoreHeaders() {
  return { 'Cache-Control': 'private, no-store' }
}

export function reportTimingHeaders(startedAt: number, authStartedAt: number, authFinishedAt: number) {
  const now = performance.now()
  return {
    ...noStoreHeaders(),
    'Server-Timing': [
      `auth;dur=${Math.round(authFinishedAt - authStartedAt)}`,
      `service;dur=${Math.round(now - authFinishedAt)}`,
      `total;dur=${Math.round(now - startedAt)}`,
    ].join(', '),
  }
}
