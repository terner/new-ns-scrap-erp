import type { WeightTicketStatus, WeightTicketType } from '@/lib/weight-tickets'
import type { WeightTicketTeamDraft } from '@/lib/weight-ticket-drafts'

type WorkingDraftFilter = {
  branchCode: string | null
  dateFrom: string
  dateTo: string
  query: string
  status: WeightTicketStatus[]
  type: WeightTicketType
}

function normalized(value: string | null | undefined) {
  return String(value ?? '').trim().toLocaleLowerCase()
}

function matchesDateRange(value: string, dateFrom: string, dateTo: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const day = date.toISOString().slice(0, 10)
  return (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo)
}

export function filterWeightTicketWorkingDrafts(
  drafts: WeightTicketTeamDraft[],
  filters: WorkingDraftFilter,
) {
  const query = normalized(filters.query)
  const statusAllowsDrafts = filters.status.length === 0 || filters.status.includes('draft')

  return drafts.filter((draft) => {
    if (draft.type !== filters.type || !statusAllowsDrafts) return false
    if (filters.branchCode && normalized(draft.branchId) !== normalized(filters.branchCode)) return false
    if (!matchesDateRange(draft.savedAt, filters.dateFrom, filters.dateTo)) return false
    if (!query) return true

    const searchText = [
      draft.documentNo,
      draft.drafterName,
      draft.partyName,
      draft.branchName,
      ...draft.productNames,
      draft.activityDescription,
    ].map(normalized).join(' ')
    return searchText.includes(query)
  })
}

export function refreshSelectedWeightTicketWorkingDraft(
  selected: WeightTicketTeamDraft | null,
  drafts: WeightTicketTeamDraft[],
) {
  if (!selected) return null
  return drafts.find((draft) => draft.draftKey === selected.draftKey) ?? null
}
