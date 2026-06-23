import type { WeightTicketRecord } from '@/lib/weight-tickets'

type WeightTicketSyncAction = 'cancel' | 'create' | 'update'

export async function syncWeightTicketToGoogleSheets(_action: WeightTicketSyncAction, _ticket: WeightTicketRecord) {
  // Google Sheets integration is optional. Keep the ERP write path authoritative
  // and avoid failing weight-ticket create/update/cancel when no connector is configured.
  return Promise.resolve()
}
