import * as React from 'react'

import { cn } from '@/lib/utils'

type CardProps = React.HTMLAttributes<HTMLDivElement>

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-md border border-scrap-line bg-white p-4 shadow-sm', className)}
      {...props}
    >
      {children}
    </div>
  )
}
