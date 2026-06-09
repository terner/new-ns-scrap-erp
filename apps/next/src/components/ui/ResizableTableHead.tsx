'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Align = 'center' | 'left' | 'right'
type SortDirection = 'asc' | 'desc'

export function ResizableTableHead<TSortKey extends string>({
  activeSortKey,
  align = 'left',
  direction,
  label,
  resizeProps,
  sortKey,
  onSort,
}: {
  activeSortKey?: TSortKey
  align?: Align
  direction?: SortDirection
  label: ReactNode
  onSort?: (key: TSortKey) => void
  resizeProps?: ButtonHTMLAttributes<HTMLButtonElement>
  sortKey?: TSortKey
}) {
  const alignClass = align === 'right' ? 'justify-end text-right' : align === 'center' ? 'justify-center text-center' : 'justify-start text-left'
  const active = Boolean(sortKey && activeSortKey === sortKey)
  const content = (
    <>
      <span className="truncate">{label}</span>
      {sortKey ? <span className="shrink-0 text-slate-400">{active ? direction === 'asc' ? '▲' : '▼' : '↕'}</span> : null}
    </>
  )

  return (
    <th className={`relative p-0 text-xs font-semibold text-slate-700 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}>
      {sortKey && onSort ? (
        <button className={`flex w-full min-w-0 items-center gap-1 p-2 pr-4 hover:bg-slate-200 ${alignClass}`} type="button" onClick={() => onSort(sortKey)}>
          {content}
        </button>
      ) : (
        <div className={`flex min-w-0 items-center gap-1 p-2 pr-4 ${alignClass}`}>
          {content}
        </div>
      )}
      {resizeProps ? (
        <button
          {...resizeProps}
          className="absolute right-0 top-1/2 h-5 w-3 -translate-y-1/2 cursor-col-resize touch-none rounded-sm focus:outline-none"
          type="button"
        />
      ) : null}
    </th>
  )
}
