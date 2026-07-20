'use client'

import * as React from 'react'
import { MoreHorizontal, Pencil, XCircle } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type TableActionButtonProps = Omit<ButtonProps, 'children'> & {
  busy?: boolean
  children?: React.ReactNode
  label?: string
  menu?: React.ReactNode
}

export const tableActionButtonClassName =
  'h-12 rounded-xl border border-slate-300/90 bg-white px-4 text-base font-semibold text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.08)] hover:bg-slate-50 hover:text-slate-900'

export const TableActionButton = React.forwardRef<HTMLButtonElement, TableActionButtonProps>(function TableActionButton(
  { busy = false, children, className, label = 'จัดการ', menu, type = 'button', variant = 'outline', ...props },
  ref,
) {
  const trigger = (
    <Button
      className={cn(tableActionButtonClassName, className)}
      ref={ref}
      size={undefined}
      type={type}
      variant={variant}
      {...props}
    >
      <MoreHorizontal aria-hidden="true" className="mr-2 size-5 shrink-0 text-slate-600" />
      <span>{busy ? 'กำลังทำ...' : 'จัดการ'}</span>
    </Button>
  )
  if (!menu) return trigger
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[190px] overflow-hidden rounded-xl p-0">
        {menu}
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

export const TableActionMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuItem>
>(function TableActionMenuItem({ children, className, ...props }, ref) {
  const text = typeof children === 'string' ? children : ''
  const isCancel = text.includes('ยกเลิก') || text.includes('ลบ')
  const icon = text.includes('แก้ไข')
    ? <Pencil className="size-5 shrink-0" />
    : isCancel
      ? <XCircle className="size-5 shrink-0" />
      : null

  return (
    <DropdownMenuItem
      className={cn(
        'min-h-14 gap-3 rounded-none border-b border-slate-200 px-4 text-base font-semibold last:border-b-0',
        isCancel ? 'text-red-600 focus:bg-red-50 focus:text-red-700' : 'text-slate-800',
        className,
      )}
      ref={ref}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </DropdownMenuItem>
  )
})
