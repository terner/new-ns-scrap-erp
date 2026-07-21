'use client'

import { useCallback, useRef, useState } from 'react'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WeightTicketWtiForm, type WeightTicketTypeFormProps } from '@/components/daily/WeightTicketWtiForm'
import { WeightTicketWtoForm } from '@/components/daily/WeightTicketWtoForm'
import type { WeightTicketType } from '@/lib/weight-tickets'

type WeightTicketsPageClientProps = WeightTicketTypeFormProps & {
  initialType?: WeightTicketType
  lockType?: boolean
}

function ticketTypeFromDocumentId(ticketId: string, defaultType: WeightTicketType) {
  const normalized = ticketId.trim().toUpperCase()
  if (normalized.startsWith('WTO')) return 'WTO'
  if (normalized.startsWith('WTI')) return 'WTI'
  return defaultType
}

export function WeightTicketsPageClient({
  initialType = 'WTI',
  lockType = false,
  ticketId = '',
  ...formProps
}: WeightTicketsPageClientProps) {
  const editing = Boolean(ticketId.trim())
  const resolvedInitialType = ticketTypeFromDocumentId(ticketId, initialType)
  const [activeType, setActiveType] = useState<WeightTicketType>(resolvedInitialType)
  const [dirty, setDirty] = useState(false)
  const [isChangingType, setIsChangingType] = useState(false)
  const discardWorkingDraftRef = useRef<(() => Promise<boolean>) | null>(null)
  const showTabs = !lockType && !editing

  const registerWorkingDraftDiscard = useCallback((discard: (() => Promise<boolean>) | null) => {
    discardWorkingDraftRef.current = discard
  }, [])

  async function changeType(nextType: WeightTicketType) {
    if (isChangingType) return
    if (nextType === activeType) return
    if (dirty && !window.confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการเปลี่ยนประเภทเอกสารและล้างข้อมูลหรือไม่?')) return
    setIsChangingType(true)
    try {
      const discarded = await (discardWorkingDraftRef.current?.() ?? Promise.resolve(true))
      if (!discarded) return
      setDirty(false)
      setActiveType(nextType)
    } finally {
      setIsChangingType(false)
    }
  }

  const form = activeType === 'WTI' ? (
    <WeightTicketWtiForm
      key="WTI"
      {...formProps}
      hideTypeHeader={showTabs}
      ticketId={ticketId}
      onDirtyChange={setDirty}
      onWorkingDraftDiscardReady={registerWorkingDraftDiscard}
    />
  ) : (
    <WeightTicketWtoForm
      key="WTO"
      {...formProps}
      hideTypeHeader={showTabs}
      ticketId={ticketId}
      onDirtyChange={setDirty}
      onWorkingDraftDiscardReady={registerWorkingDraftDiscard}
    />
  )

  if (!showTabs) return form

  return (
    <div className="space-y-5">
      <Tabs value={activeType} onValueChange={(value) => void changeType(value as WeightTicketType)}>
        <TabsList className="w-full justify-start" variant="line">
          <TabsTrigger disabled={isChangingType} value="WTI" variant="line">ใบรับของ WTI</TabsTrigger>
          <TabsTrigger disabled={isChangingType} value="WTO" variant="line">ใบส่งของ WTO</TabsTrigger>
        </TabsList>
      </Tabs>
      {form}
    </div>
  )
}
