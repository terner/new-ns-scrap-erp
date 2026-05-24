'use client'

import * as React from 'react'
import { Select } from '@/components/ui/Select'

type FormSelectFieldProps = {
  children: React.ReactNode
  className?: string
  disabled?: boolean
  error?: string
  hidePlaceholderWhenSelected?: boolean
  label: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  value: string
}

export function FormSelectField({
  children,
  className = '',
  disabled = false,
  error,
  hidePlaceholderWhenSelected = true,
  label,
  onChange,
  placeholder,
  required = false,
  value,
}: FormSelectFieldProps) {
  return (
    <label className={`block text-sm font-medium ${className}`}>
      {label}{required ? <span className="ml-1 text-red-600">*</span> : null}
      <Select
        className={`mt-1.5 w-full ${error ? 'border-red-400 bg-red-50' : ''}`}
        disabled={disabled}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {placeholder ? <option disabled={required} hidden={hidePlaceholderWhenSelected} value="">{placeholder}</option> : null}
        {children}
      </Select>
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  )
}
