'use client'

import * as TabsPrimitive from '@radix-ui/react-tabs'
import type * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const tabsListVariants = cva(
  'inline-flex items-center justify-start',
  {
    variants: {
      variant: {
        default: 'rounded-md bg-slate-100 p-1 text-slate-600',
        line: 'h-auto gap-1 rounded-none border-b border-slate-200 bg-transparent p-0 text-slate-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const tabsTriggerVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-slate-950',
  {
    variants: {
      variant: {
        default: 'rounded-sm px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm',
        line: 'border-b-2 border-transparent px-3 py-2 text-slate-500 data-[state=active]:border-blue-600 data-[state=active]:text-slate-950',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn('flex flex-col gap-4', className)} {...props} />
}

function TabsList({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & VariantProps<typeof tabsTriggerVariants>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn('outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
