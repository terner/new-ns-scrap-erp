'use client'

import * as React from 'react'
import { sanitizePhoneInput } from '@/lib/format'
import { cn } from '@/lib/utils'

type PhoneInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'inputMode' | 'onChange' | 'type' | 'value'> & {
  error?: boolean
  onChange: (value: string) => void
  value?: string | null
}

export function PhoneInput({
  className,
  error = false,
  onChange,
  placeholder,
  value,
  ...props
}: PhoneInputProps) {
  return (
    <div className={cn('relative w-full', className)}>
      <input
        {...props}
        className={cn(
          'w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700',
          error ? 'border-red-400 bg-red-50' : undefined,
        )}
        inputMode="tel"
        placeholder={placeholder ?? 'เช่น 0812345678'}
        type="tel"
        value={value ?? ''}
        onChange={(event) => {
          onChange(sanitizePhoneInput(event.target.value))
        }}
      />
    </div>
  )
}
