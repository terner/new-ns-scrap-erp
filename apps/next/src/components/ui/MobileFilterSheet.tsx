'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type MobileFilterSheetProps = {
  bodyClassName?: string
  children: ReactNode
  footer: ReactNode
  onClose: () => void
  title: string
  visibleClassName?: string
}

export function MobileFilterSheet({
  bodyClassName,
  children,
  footer,
  onClose,
  title,
  visibleClassName = 'lg:hidden',
}: MobileFilterSheetProps) {
  return (
    <div className={cn('fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/55', visibleClassName)} onClick={onClose}>
      <div
        className="flex max-h-[calc(100dvh_-_env(safe-area-inset-top)_-_0.75rem)] w-full flex-col overflow-hidden rounded-t-md bg-slate-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between rounded-t-md bg-slate-900 px-4 py-4 text-white">
          <h4 className="text-sm font-bold text-white">{title}</h4>
          <button
            aria-label="ปิดตัวกรอง"
            className="rounded-md p-1 text-xl font-bold text-slate-300 hover:bg-slate-800 hover:text-white"
            onClick={onClose}
            type="button"
          >
            &times;
          </button>
        </div>

        <div className={cn('flex-1 space-y-4 overflow-y-auto bg-white p-4', bodyClassName)}>{children}</div>

        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)_+_1rem)]">{footer}</div>
      </div>
    </div>
  )
}
