# Shared UI Components

Next.js 16 / React 19 / Tailwind CSS 4 with custom primitives, Base UI, Radix, and Lucide icons. Full source for the shared controls used by WTI/WTO follows.

## `apps/next/src/components/ui/Button.tsx`

```tsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 px-4 py-2 text-white hover:bg-blue-700',
        secondary: 'bg-slate-100 px-3 py-2 text-slate-700 hover:bg-slate-200',
        outline: 'border border-slate-300 bg-white px-3 py-2 text-slate-700 shadow-xs hover:bg-slate-100 hover:text-slate-900',
        export: 'border border-emerald-700 bg-emerald-600 px-3 py-2 text-white shadow-xs hover:bg-emerald-700',
        ghost: 'text-slate-700 hover:bg-slate-100',
      },
      size: {
        default: 'h-10',
        sm: 'h-9 px-3',
        xs: 'h-8 px-3 text-xs',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, className, size, variant, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ className, size, variant }))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'

export { buttonVariants }

```

## `apps/next/src/components/ui/Card.tsx`

```tsx
import * as React from 'react'

import { cn } from '@/lib/utils'

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-slate-200/60 bg-white text-slate-950 shadow-sm',
        className
      )}
      {...props}
    />
  )
)
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      {...props}
    />
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('font-bold leading-none tracking-tight text-slate-900', className)}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-slate-500', className)}
      {...props}
    />
  )
)
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center p-6 pt-0', className)}
      {...props}
    />
  )
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }

```

## `apps/next/src/components/ui/Input.tsx`

```tsx
import * as React from 'react'

import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        autoComplete="off"
        className={cn(
          'flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-slate-700 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm dark:placeholder:text-slate-500',
          className,
        )}
        ref={ref}
        type={type}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

```

## `apps/next/src/components/ui/BranchSelectCombobox.tsx`

```tsx
'use client'

import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox'

type BranchOption = {
  id: string
  name: string
}

export function BranchSelectCombobox({
  allOptionLabel = 'ทุกสาขา',
  branches,
  className,
  controlSize = 'form',
  disabled = false,
  error,
  errorKey,
  includeAllOption = false,
  inputId,
  label,
  placeholder,
  value,
  widthClassName,
  onChange,
}: {
  allOptionLabel?: string
  branches: BranchOption[]
  className?: string
  controlSize?: 'filter' | 'form'
  disabled?: boolean
  error?: string
  errorKey?: string
  includeAllOption?: boolean
  inputId: string
  label?: string
  placeholder: string
  value: string | null | undefined
  widthClassName?: string
  onChange: (branchId: string | null) => void
}) {
  const safeLabel = label?.trim() ?? ''
  const hasInlineRequired = safeLabel.endsWith('*')
  const labelText = hasInlineRequired ? safeLabel.slice(0, -1).trimEnd() : safeLabel
  const options = includeAllOption
    ? [{ id: '__all__', name: allOptionLabel }, ...branches]
    : branches
  const selectedName = value ? branches.find((branch) => branch.id === value)?.name : includeAllOption ? allOptionLabel : undefined
  const controlHeight = controlSize === 'filter' ? 'h-9' : 'h-10'

  return (
    <div className={`${className ?? ''} ${widthClassName ?? ''}`.trim() || undefined} data-error-key={errorKey}>
      {safeLabel ? <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor={inputId}>{labelText}{hasInlineRequired ? <span className="ml-1 text-red-600">*</span> : null}</label> : null}
      <div className="relative">
        <Combobox
          disabled={disabled}
          inputId={inputId}
          items={options.map((branch) => branch.name)}
          value={selectedName}
          onValueChange={(branchName) => {
            if (includeAllOption && branchName === allOptionLabel) {
              onChange(null)
              return
            }
            const branch = branches.find((item) => item.name === branchName)
            onChange(branch?.id ?? null)
          }}
        >
          <ComboboxInput
            aria-invalid={Boolean(error)}
            aria-label={safeLabel || placeholder}
            className={error ? `${controlHeight} rounded-md border-red-400 bg-red-50 px-3 py-2 text-sm` : `${controlHeight} rounded-md px-3 py-2 text-sm`}
            inputGroupClassName={error ? `${controlHeight} rounded-md border-red-400 ring-red-100 has-[[data-slot=input-group-control]:focus-visible]:border-red-500 has-[[data-slot=input-group-control]:focus-visible]:ring-red-500/20` : `${controlHeight} rounded-md border-slate-300`}
            placeholder={placeholder}
            readOnly
            withDropdownButton
          />
          <ComboboxContent>
            <ComboboxEmpty>ไม่พบข้อมูลที่ตรงกับคำค้นหา</ComboboxEmpty>
            <ComboboxList>
              {(branchName) => (
                <ComboboxItem key={String(branchName)} value={String(branchName)}>
                  {String(branchName)}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </div>
  )
}

```

## `apps/next/src/components/ui/SearchCombobox.tsx`

```tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

export type SearchComboboxOption = {
  description?: string
  id: string
  label: string
  searchText?: string
}

export function SearchCombobox({
  disabled = false,
  error,
  errorKey,
  hideLabel = false,
  hideSelectedOptionFromList = false,
  inputClassName,
  inputId,
  label,
  options,
  optionsPanelClassName,
  openOnFocus = true,
  placeholder,
  value,
  onChange,
}: {
  disabled?: boolean
  error?: string
  errorKey?: string
  hideLabel?: boolean
  hideSelectedOptionFromList?: boolean
  inputClassName?: string
  inputId: string
  label: string
  options: SearchComboboxOption[]
  optionsPanelClassName?: string
  openOnFocus?: boolean
  placeholder?: string
  value: string
  onChange: (optionId: string) => void
}) {
  const shouldAutoSelectText = () => {
    if (typeof window === 'undefined') return true
    return !window.matchMedia('(pointer: coarse)').matches
  }
  const hasInlineRequired = label.trim().endsWith('*')
  const labelText = hasInlineRequired ? label.trim().slice(0, -1).trimEnd() : label
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const portalHostRef = useRef<HTMLElement | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const hasMovedRef = useRef(false)
  const selectedOption = useMemo(() => options.find((option) => option.id === value) ?? null, [options, value])
  const selectedLabel = selectedOption?.label ?? ''
  const selectedLabelQuery = selectedLabel.trim().toLowerCase()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(selectedLabel)
  const [panelRect, setPanelRect] = useState<{ left: number; top: number; width: number } | null>(null)
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const isSelectedValueQuery = Boolean(selectedOption) && query.trim().toLowerCase() === selectedLabelQuery

  const lastEmittedValueRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastEmittedValueRef.current === null || lastEmittedValueRef.current !== value) {
      setQuery(selectedLabel)
    }
    lastEmittedValueRef.current = value
  }, [value, selectedLabel])

  useEffect(() => {
    const input = inputRef.current
    if (!input || typeof document === 'undefined') return
    const scopedPortalHost = input.closest('[role="dialog"]') || input.closest('[data-combobox-portal-root="true"]')
    const resolvedPortalHost = scopedPortalHost instanceof HTMLElement ? scopedPortalHost : document.body
    portalHostRef.current = resolvedPortalHost
    setPortalHost(resolvedPortalHost)
  }, [])

  useEffect(() => {
    if (!open) return

    const updatePanelRect = () => {
      const input = inputRef.current
      if (!input) return
      const inputRect = input.getBoundingClientRect()
      const viewport = window.visualViewport
      const viewportLeft = viewport?.offsetLeft ?? 0
      const viewportWidth = viewport?.width ?? window.innerWidth
      const gutter = 8
      const clampToViewport = (left: number, right: number, width: number) => {
        const availableWidth = Math.max(160, right - left)
        const nextWidth = Math.min(width, availableWidth)
        const nextLeft = Math.min(Math.max(inputRect.left, left), right - nextWidth)
        return {
          left: nextLeft,
          width: nextWidth,
        }
      }
      const host = portalHostRef.current
      if (!host || host === document.body) {
        const clamped = clampToViewport(
          viewportLeft + gutter,
          viewportLeft + viewportWidth - gutter,
          inputRect.width,
        )
        setPanelRect({
          left: clamped.left,
          top: inputRect.bottom + 4,
          width: clamped.width,
        })
        return
      }

      const hostRect = host.getBoundingClientRect()
      const clamped = clampToViewport(
        Math.max(hostRect.left, viewportLeft + gutter),
        Math.min(hostRect.right, viewportLeft + viewportWidth - gutter),
        inputRect.width,
      )
      setPanelRect({
        left: clamped.left - hostRect.left + host.scrollLeft,
        top: inputRect.bottom - hostRect.top + host.scrollTop + 4,
        width: clamped.width,
      })
    }

    updatePanelRect()
    window.addEventListener('resize', updatePanelRect)
    window.addEventListener('scroll', updatePanelRect, true)
    window.visualViewport?.addEventListener('resize', updatePanelRect)
    window.visualViewport?.addEventListener('scroll', updatePanelRect)
    return () => {
      window.removeEventListener('resize', updatePanelRect)
      window.removeEventListener('scroll', updatePanelRect, true)
      window.visualViewport?.removeEventListener('resize', updatePanelRect)
      window.visualViewport?.removeEventListener('scroll', updatePanelRect)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement
      if (containerRef.current?.contains(target)) return

      const optionsPanel = document.getElementById(`${inputId}-options`)
      if (optionsPanel?.contains(target)) return

      const exactMatch = options.find((option) => option.label.toLowerCase() === query.trim().toLowerCase())
      if (exactMatch) {
        lastEmittedValueRef.current = exactMatch.id
        onChange(exactMatch.id)
        setQuery(exactMatch.label)
      } else if (selectedOption) {
        setQuery(selectedOption.label)
      } else {
        setQuery('')
      }
      setOpen(false)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [open, options, query, selectedOption, onChange, inputId])

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const rows = normalizedQuery
      ? isSelectedValueQuery
        ? options
        : options.filter((option) => (option.searchText ?? option.label).toLowerCase().includes(normalizedQuery))
      : options
    return (hideSelectedOptionFromList && value ? rows.filter((option) => option.id !== value) : rows).slice(0, 80)
  }, [hideSelectedOptionFromList, isSelectedValueQuery, options, query, value])

  useEffect(() => {
    if (!open) {
      setHighlightedIndex(-1)
      return
    }

    if (filteredOptions.length === 0) {
      setHighlightedIndex(-1)
      return
    }

    const selectedIndex = filteredOptions.findIndex((option) => option.id === value)
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [filteredOptions, open, value])

  useEffect(() => {
    if (highlightedIndex < 0) return
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex])

  const selectOption = (option: SearchComboboxOption) => {
    if (disabled) return
    lastEmittedValueRef.current = option.id
    onChange(option.id)
    setQuery(option.label)
    setOpen(false)
    if (shouldAutoSelectText()) inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative" data-error-key={errorKey}>
      {!hideLabel ? <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor={inputId}>{labelText}{hasInlineRequired ? <span className="ml-1 text-red-600">*</span> : null}</label> : null}
      <Input
        ref={inputRef}
        aria-autocomplete="list"
        aria-activedescendant={open && highlightedIndex >= 0 ? `${inputId}-option-${highlightedIndex}` : undefined}
        aria-controls={`${inputId}-options`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={Boolean(error)}
        className={cn(
          'h-10 w-full rounded-md border px-3 py-2 text-base focus-visible:!border-[#737373] focus-visible:!ring-[3px] focus-visible:!ring-neutral-500/20 sm:text-sm',
          error ? 'border-red-400 bg-red-50 focus-visible:!border-red-500 focus-visible:!ring-red-500/20 dark:border-red-500 dark:bg-red-950/20' : 'border-slate-300 dark:[border-color:var(--ns-dark-border-strong)]',
          inputClassName,
        )}
        disabled={disabled}
        id={inputId}
        placeholder={placeholder}
        role="combobox"
        required={hasInlineRequired}
        type="search"
        value={query}
        onClick={() => {
          if (disabled) return
          setOpen(true)
          if (!isSelectedValueQuery) return
          if (!shouldAutoSelectText()) return
          requestAnimationFrame(() => inputRef.current?.select())
        }}

        onChange={(event) => {
          if (disabled) return
          const nextQuery = event.target.value
          setQuery(nextQuery)
          setOpen(true)
          if (value && nextQuery !== selectedLabel) {
            lastEmittedValueRef.current = ''
            onChange('')
          }
        }}
        onFocus={() => {
          if (disabled) return
          if (openOnFocus) setOpen(true)
          if (!isSelectedValueQuery) return
          if (!shouldAutoSelectText()) return
          requestAnimationFrame(() => inputRef.current?.select())
        }}
        onBlur={() => {
          // Delay close so a click on a portal option (which blurs the input
          // first) still registers. Restores the query like handleOutsideClick
          // does, and prevents multiple combobox popups stacking in forms that
          // render more than one (e.g. production order product pickers).
          window.setTimeout(() => {
            if (!open) return
            const exactMatch = options.find((option) => option.label.toLowerCase() === query.trim().toLowerCase())
            if (exactMatch) {
              lastEmittedValueRef.current = exactMatch.id
              onChange(exactMatch.id)
              setQuery(exactMatch.label)
            } else if (selectedOption) {
              setQuery(selectedOption.label)
            } else {
              setQuery('')
            }
            setOpen(false)
          }, 150)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false)
            return
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (!open) {
              setOpen(true)
              return
            }
            if (filteredOptions.length === 0) return
            setHighlightedIndex((current) => {
              if (current < 0) return 0
              return Math.min(current + 1, filteredOptions.length - 1)
            })
            return
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) {
              setOpen(true)
              return
            }
            if (filteredOptions.length === 0) return
            setHighlightedIndex((current) => {
              if (current < 0) return filteredOptions.length - 1
              return Math.max(current - 1, 0)
            })
            return
          }
          if (event.key === 'Enter' && open && filteredOptions[highlightedIndex >= 0 ? highlightedIndex : 0]) {
            event.preventDefault()
            selectOption(filteredOptions[highlightedIndex >= 0 ? highlightedIndex : 0])
          }
        }}
      />
      {open && panelRect && portalHost
        ? createPortal(
            <div
              id={`${inputId}-options`}
              className={`${portalHost === document.body ? 'fixed' : 'absolute'} z-[80] max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 text-base shadow-xl sm:text-sm dark:[border-color:var(--ns-dark-border-strong)] dark:[background-color:var(--ns-dropdown-surface)] ${optionsPanelClassName ?? ''}`.trim()}
              role="listbox"
              style={{ left: panelRect.left, top: panelRect.top, width: panelRect.width }}
            >
              {filteredOptions.length > 0 ? filteredOptions.map((option, index) => (
                <button
                  key={option.id}
                  ref={(element) => {
                    optionRefs.current[index] = element
                  }}
                  id={`${inputId}-option-${index}`}
                  aria-selected={option.id === value}
                  className={`block w-full overflow-hidden rounded-sm px-3 py-2 text-left text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:[background-color:var(--ns-dropdown-selected)] ${option.id === value ? 'bg-slate-100 text-slate-900 dark:![background-color:var(--ns-dropdown-selected)] dark:![color:var(--ns-dark-text)]' : highlightedIndex === index ? 'bg-slate-100 text-slate-900 dark:![background-color:var(--ns-dropdown-selected)] dark:![color:var(--ns-dark-text)]' : ''}`}
                  role="option"
                  type="button"
                  onMouseDownCapture={(event) => {
                    event.stopPropagation()
                    selectOption(option)
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onTouchStartCapture={(event) => {
                    const touch = event.touches[0]
                    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
                    hasMovedRef.current = false
                  }}
                  onTouchMoveCapture={(event) => {
                    if (!touchStartRef.current) return
                    const touch = event.touches[0]
                    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x)
                    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y)
                    if (deltaX > 10 || deltaY > 10) {
                      hasMovedRef.current = true
                    }
                  }}
                  onTouchEndCapture={(event) => {
                    event.stopPropagation()
                    if (!hasMovedRef.current) {
                      event.preventDefault()
                      selectOption(option)
                    }
                    touchStartRef.current = null
                  }}
                  onClick={(event) => {
                    event.preventDefault()
                  }}
                >
                  <span className="block break-words font-medium">{option.label}</span>
                  {option.description ? <span className="block break-words text-sm text-slate-500 sm:text-xs dark:text-slate-400">{option.description}</span> : null}
                </button>
              )) : <div className="px-3 py-2 text-base text-slate-500 sm:text-sm dark:text-slate-400">ไม่พบข้อมูลที่ตรงกับคำค้นหา</div>}
            </div>,
            portalHost,
          )
        : null}
    </div>
  )
}

```

## `apps/next/src/components/ui/combobox.tsx`

```tsx
'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'

import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

type PrimitiveItem = string | {
  description?: string
  label?: string
  searchText?: string
  value: string
}

type NormalizedItem = {
  description?: string
  label: string
  raw: PrimitiveItem
  searchText: string
  value: string
}

type ComboboxContextValue = {
  disabled: boolean
  filteredItems: NormalizedItem[]
  highlightedIndex: number
  inputId?: string
  open: boolean
  query: string
  selectValue: (value: string) => void
  selectedValue?: string
  setHighlightedIndex: React.Dispatch<React.SetStateAction<number>>
  setOpen: (open: boolean) => void
  setQuery: (query: string) => void
}

const ComboboxContext = React.createContext<ComboboxContextValue | null>(null)

function useComboboxContext(componentName: string) {
  const context = React.useContext(ComboboxContext)
  if (!context) throw new Error(`${componentName} must be used within <Combobox>`)
  return context
}

function normalizeItem(item: PrimitiveItem): NormalizedItem {
  if (typeof item === 'string') {
    return {
      label: item,
      raw: item,
      searchText: item.toLowerCase(),
      value: item,
    }
  }
  const label = item.label ?? item.value
  return {
    description: item.description,
    label,
    raw: item,
    searchText: (item.searchText ?? `${item.value} ${label}`).toLowerCase(),
    value: item.value,
  }
}

export function Combobox({
  children,
  disabled = false,
  inputId,
  items,
  value,
  onValueChange,
}: {
  children: React.ReactNode
  disabled?: boolean
  inputId?: string
  items: PrimitiveItem[]
  onValueChange?: (value: string) => void
  value?: string
}) {
  const normalizedItems = React.useMemo(() => items.map(normalizeItem), [items])
  const selectedItem = React.useMemo(() => normalizedItems.find((item) => item.value === value) ?? null, [normalizedItems, value])
  const selectedLabel = selectedItem?.label ?? ''
  const selectedLabelQuery = selectedLabel.trim().toLowerCase()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState(selectedLabel)
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
  const isSelectedValueQuery = Boolean(selectedItem) && query.trim().toLowerCase() === selectedLabelQuery

  React.useEffect(() => {
    setQuery(selectedLabel)
  }, [selectedLabel])

  const filteredItems = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const rows = normalizedQuery
      ? isSelectedValueQuery
        ? normalizedItems
        : normalizedItems.filter((item) => item.searchText.includes(normalizedQuery) || item.label.toLowerCase().includes(normalizedQuery))
      : normalizedItems
    return rows.slice(0, 80)
  }, [isSelectedValueQuery, normalizedItems, query])

  const selectValue = React.useCallback((nextValue: string) => {
    const item = normalizedItems.find((entry) => entry.value === nextValue)
    onValueChange?.(nextValue)
    setQuery(item?.label ?? '')
    setOpen(false)
  }, [normalizedItems, onValueChange])

  React.useEffect(() => {
    if (!open || filteredItems.length === 0) {
      setHighlightedIndex(-1)
      return
    }

    const selectedIndex = filteredItems.findIndex((item) => item.value === value)
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [filteredItems, open, value])

  const contextValue = React.useMemo<ComboboxContextValue>(() => ({
    disabled,
    filteredItems,
    highlightedIndex,
    inputId,
    open,
    query,
    selectValue,
    selectedValue: value,
    setHighlightedIndex,
    setOpen,
    setQuery,
  }), [disabled, filteredItems, highlightedIndex, inputId, open, query, selectValue, value])

  return <ComboboxContext.Provider value={contextValue}>{children}</ComboboxContext.Provider>
}

export function ComboboxInput({
  buttonClassName,
  className,
  inputGroupClassName,
  placeholder,
  withDropdownButton = false,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  buttonClassName?: string
  inputGroupClassName?: string
  withDropdownButton?: boolean
}) {
  const { disabled, filteredItems, highlightedIndex, inputId, open, query, selectValue, selectedValue, setHighlightedIndex, setOpen, setQuery } = useComboboxContext('ComboboxInput')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const selectedItem = React.useMemo(() => filteredItems.find((item) => item.value === selectedValue) ?? null, [filteredItems, selectedValue])
  const selectedLabel = selectedItem?.label ?? query
  const isSelectedValueQuery = Boolean(selectedItem) && query.trim().toLowerCase() === selectedLabel.trim().toLowerCase()

  const inputNode = (
    <Input
      ref={inputRef}
      aria-autocomplete="list"
      aria-activedescendant={open && highlightedIndex >= 0 && inputId ? `${inputId}-option-${highlightedIndex}` : undefined}
      aria-controls={inputId ? `${inputId}-options` : undefined}
      aria-expanded={open}
      aria-haspopup="listbox"
      className={cn(
        className,
        withDropdownButton ? 'w-full rounded-md-none border-0 bg-transparent pr-8 shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent' : undefined,
      )}
      data-slot={withDropdownButton ? 'input-group-control' : undefined}
      disabled={disabled || props.disabled}
      id={inputId}
      placeholder={placeholder}
      role="combobox"
      type={withDropdownButton ? 'text' : 'search'}
      value={query}
      {...props}
      onBlur={() => {
        if (disabled) return
        window.setTimeout(() => {
          const exactMatch = filteredItems.find((item) => item.label.toLowerCase() === query.trim().toLowerCase())
          if (exactMatch) {
            selectValue(exactMatch.value)
          } else {
            setQuery(selectedLabel)
            setOpen(false)
          }
        }, 120)
      }}
      onChange={(event) => {
        if (disabled) return
        const nextQuery = event.target.value
        setQuery(nextQuery)
        setOpen(true)
        if (selectedValue && nextQuery !== selectedLabel) {
          onValueChangeFallback(selectValue)
        }
      }}
      onClick={() => {
        if (disabled) return
        setOpen(true)
        if (props.readOnly) return
        if (!isSelectedValueQuery) return
        requestAnimationFrame(() => inputRef.current?.select())
      }}
      onFocus={() => {
        if (disabled) return
        setOpen(true)
        if (props.readOnly) return
        if (!isSelectedValueQuery) return
        requestAnimationFrame(() => inputRef.current?.select())
      }}
      onKeyDown={(event) => {
        if (disabled) return
        if (event.key === 'Escape') {
          setOpen(false)
          return
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          if (!open) {
            setOpen(true)
            return
          }
          if (filteredItems.length === 0) return
          setHighlightedIndex((current) => current < 0 ? 0 : Math.min(current + 1, filteredItems.length - 1))
          return
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          if (!open) {
            setOpen(true)
            return
          }
          if (filteredItems.length === 0) return
          setHighlightedIndex((current) => current < 0 ? filteredItems.length - 1 : Math.max(current - 1, 0))
          return
        }
        const highlightedItem = filteredItems[highlightedIndex >= 0 ? highlightedIndex : 0]
        if (event.key === 'Enter' && open && highlightedItem) {
          event.preventDefault()
          selectValue(highlightedItem.value)
        }
      }}
    />
  )

  if (!withDropdownButton) return inputNode

  return (
    <div
      className={cn(
        'group/input-group relative flex h-8 min-w-0 items-center overflow-hidden rounded-md border border-slate-300 bg-white transition-colors outline-none has-[[data-slot=input-group-control]:focus-visible]:border-[#737373] has-[[data-slot=input-group-control]:focus-visible]:ring-[3px] has-[[data-slot=input-group-control]:focus-visible]:ring-neutral-500/20 dark:[border-color:var(--ns-dark-border-strong)] dark:[background-color:var(--ns-dark-surface-soft)] dark:has-[[data-slot=input-group-control]:focus-visible]:border-[#737373] dark:has-[[data-slot=input-group-control]:focus-visible]:ring-neutral-500/20',
        inputGroupClassName,
      )}
      data-slot="input-group"
      role="group"
    >
      {inputNode}
      <button
        aria-controls={inputId ? `${inputId}-options` : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="เปิดรายการตัวเลือก"
        className={cn(
          'absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md border-0 p-0 text-slate-500 transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50',
          buttonClassName,
        )}
        disabled={disabled}
        data-placeholder=""
        data-size="icon-xs"
        data-slot="input-group-button"
        tabIndex={-1}
        type="button"
        onMouseDown={(event) => {
          if (disabled) return
          event.preventDefault()
          setOpen(!open)
          inputRef.current?.focus()
        }}
      >
        <ChevronDown className="pointer-events-none size-4 text-slate-400" />
      </button>
    </div>
  )
}

function onValueChangeFallback(selectValue: (value: string) => void) {
  selectValue('')
}

export function ComboboxContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const { inputId, open } = useComboboxContext('ComboboxContent')
  if (!open) return null
  return <div className={className ?? 'absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-xl dark:[border-color:var(--ns-dark-border-strong)] dark:[background-color:var(--ns-dropdown-surface)]'} data-slot="combobox-content" id={inputId ? `${inputId}-options` : undefined} role="listbox">{children}</div>
}

export function ComboboxEmpty({ children }: { children: React.ReactNode }) {
  const { filteredItems } = useComboboxContext('ComboboxEmpty')
  if (filteredItems.length > 0) return null
  return <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">{children}</div>
}

export function ComboboxList({ children }: { children: (item: PrimitiveItem) => React.ReactNode }) {
  const { filteredItems } = useComboboxContext('ComboboxList')
  if (filteredItems.length === 0) return null
  return <>{filteredItems.map((item) => children(item.raw))}</>
}

export function ComboboxItem({
  children,
  value,
}: {
  children: React.ReactNode
  value: string
}) {
  const { filteredItems, highlightedIndex, inputId, selectValue, selectedValue, setHighlightedIndex } = useComboboxContext('ComboboxItem')
  const itemRef = React.useRef<HTMLButtonElement>(null)
  const item = filteredItems.find((entry) => entry.value === value)
  const itemIndex = filteredItems.findIndex((entry) => entry.value === value)
  const active = selectedValue === value
  const highlighted = highlightedIndex === itemIndex

  React.useEffect(() => {
    if (highlighted) itemRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [highlighted])

  return (
    <button
      ref={itemRef}
      aria-selected={active}
      className={`block w-full px-3 py-2 text-left text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:[background-color:var(--ns-dropdown-selected)] ${active || highlighted ? 'bg-slate-100 text-slate-900 dark:![background-color:var(--ns-dropdown-selected)] dark:![color:var(--ns-dark-text)]' : ''}`}
      id={inputId && itemIndex >= 0 ? `${inputId}-option-${itemIndex}` : undefined}
      role="option"
      type="button"
      onMouseDown={(event) => {
        event.preventDefault()
        selectValue(value)
      }}
      onMouseEnter={() => setHighlightedIndex(itemIndex)}
    >
      <span className="block font-medium">{children}</span>
      {item?.description ? <span className="block text-xs text-slate-500 dark:text-slate-400">{item.description}</span> : null}
    </button>
  )
}

```

## `apps/next/src/components/ui/date-picker-input.tsx`

```tsx
'use client'

import * as React from 'react'
import { format, parse } from 'date-fns'
import { CalendarIcon } from 'lucide-react'

import { Calendar } from '@/components/ui/calendar'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

function formatDate(date: Date | undefined) {
  if (!date) return ''
  return format(date, 'yyyy-MM-dd')
}

function formatDisplayDate(date: Date | undefined) {
  if (!date) return ''
  return format(date, 'dd/MM/yyyy')
}

function parseDate(value: string) {
  if (!value.trim()) return undefined

  const trimmed = value.trim()
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? parse(trimmed, 'yyyy-MM-dd', new Date())
    : parse(trimmed, 'dd/MM/yyyy', new Date())

  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function DatePickerInput({
  ariaLabel,
  className,
  disabled = false,
  id,
  placeholder = 'วว/ดด/ปปปป',
  readOnly = false,
  required = false,
  showClearButton = true,
  showTodayButton = true,
  title,
  value,
  onChange,
}: {
  ariaLabel?: string
  className?: string
  disabled?: boolean
  id?: string
  placeholder?: string
  readOnly?: boolean
  required?: boolean
  showClearButton?: boolean
  showTodayButton?: boolean
  title?: string
  value: string
  onChange: (value: string) => void
}) {
  const generatedId = React.useId()
  const resolvedId = id ?? generatedId
  const [open, setOpen] = React.useState(false)
  const selectedDate = React.useMemo(() => parseDate(value), [value])
  const [month, setMonth] = React.useState<Date | undefined>(selectedDate)
  const [inputValue, setInputValue] = React.useState(formatDisplayDate(selectedDate))

  React.useEffect(() => {
    const nextDate = parseDate(value)
    setInputValue(formatDisplayDate(nextDate))
    if (nextDate) setMonth(nextDate)
  }, [value])

  return (
    <InputGroup className={className ?? 'w-[130px]'}>
      <InputGroupInput
        aria-label={ariaLabel}
        className="tabular-nums"
        disabled={disabled}
        id={resolvedId}
        placeholder={placeholder}
        readOnly={readOnly}
        required={required}
        title={title}
        value={inputValue}
        onBlur={() => {
          if (readOnly) return

          const nextDate = parseDate(inputValue)
          if (nextDate) {
            setInputValue(formatDisplayDate(nextDate))
            onChange(formatDate(nextDate))
            return
          }

          if (!inputValue.trim()) {
            onChange('')
            return
          }

          setInputValue(formatDisplayDate(parseDate(value)))
        }}
        onChange={(event) => {
          if (readOnly) return

          const nextValue = event.target.value
          setInputValue(nextValue)
          const nextDate = parseDate(nextValue)
          if (nextDate) {
            setMonth(nextDate)
            onChange(formatDate(nextDate))
            return
          }
          if (!nextValue.trim()) onChange('')
        }}
        onKeyDown={(event) => {
          if (readOnly || disabled) return
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      />
      <InputGroupAddon align="inline-end">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <InputGroupButton aria-label="เลือกวันที่" disabled={disabled} size="icon" type="button" variant="ghost">
              <CalendarIcon className="h-4 w-4" />
              <span className="sr-only">Select date</span>
            </InputGroupButton>
          </PopoverTrigger>
          <PopoverContent align="end" alignOffset={-8} className="w-[20rem] max-w-[calc(100vw_-_1rem)] overflow-hidden p-0" sideOffset={10}>
            <Calendar
              mode="single"
              month={month}
              selected={selectedDate}
              onMonthChange={setMonth}
              onSelect={(date) => {
                const nextValue = formatDate(date)
                setInputValue(formatDisplayDate(date))
                onChange(nextValue)
                setOpen(false)
              }}
            />
            {showTodayButton || showClearButton ? (
              <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2">
                {showClearButton ? (
                  <button
                    className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    disabled={disabled || readOnly}
                    type="button"
                    onClick={() => {
                      setInputValue('')
                      onChange('')
                      setOpen(false)
                    }}
                  >
                    Clear
                  </button>
                ) : <span />}
                {showTodayButton ? (
                  <button
                    className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    disabled={disabled || readOnly}
                    type="button"
                    onClick={() => {
                      const today = new Date()
                      setInputValue(formatDisplayDate(today))
                      setMonth(today)
                      onChange(formatDate(today))
                      setOpen(false)
                    }}
                  >
                    Today
                  </button>
                ) : null}
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
      </InputGroupAddon>
    </InputGroup>
  )
}

```

## `apps/next/src/components/ui/Dialog.tsx`

```tsx
'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-slate-950/50', className)}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean; fallbackTitle?: string; mobileAppShell?: boolean }
>(({ className, children, fallbackTitle = 'Dialog', hideClose = false, mobileAppShell = true, ...props }, ref) => {
  const classNameText = typeof className === 'string' ? className : ''
  const isMobileSheet = classNameText.includes('bottom-0') || classNameText.includes('top-auto')
  const shellMode = mobileAppShell && !isMobileSheet ? 'app' : 'dialog'

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-ns-dialog-content={shellMode}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-md border-0 bg-slate-900 !p-0 shadow-2xl duration-200 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">{fallbackTitle}</DialogPrimitive.Title>
        {children}
        {!hideClose ? (
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm text-slate-500 opacity-70 transition-opacity hover:text-slate-700 hover:opacity-100 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-slate-400 dark:hover:text-slate-200">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-ns-dialog-header
    className={cn(
      'flex flex-col space-y-1.5 rounded-t-md border-b !border-slate-200 !bg-slate-100 p-5 !text-slate-700 dark:![background-color:var(--ns-dark-table-header)] dark:![border-color:var(--ns-dark-border-strong)] dark:![color:var(--ns-dark-muted)]',
      className,
    )}
    {...props}
  />
)

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3', className)} {...props} />
)

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-lg font-bold !text-slate-800 dark:![color:var(--ns-dark-text)]', className)} {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm !text-slate-600 dark:![color:var(--ns-dark-muted)]', className)} {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}

```

## `apps/next/src/components/ui/MobileFilterSheet.tsx`

```tsx
'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

type MobileFilterSheetProps = {
  bodyClassName?: string
  children: ReactNode
  footer: ReactNode
  onClose: () => void
  title: string
  visibleClassName?: string
}

const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function MobileFilterSheet({
  bodyClassName,
  children,
  footer,
  onClose,
  title,
  visibleClassName = 'lg:hidden',
}: MobileFilterSheetProps) {
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousBodyOverflow = document.body.style.overflow
    const getFocusableElements = () => Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
    const focusFirstElement = () => {
      const first = getFocusableElements()[0]
      if (first) first.focus()
      else sheetRef.current?.focus()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = getFocusableElements()
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return

      if (!sheetRef.current?.contains(document.activeElement)) {
        event.preventDefault()
        if (event.shiftKey) last.focus()
        else first.focus()
        return
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const handleFocusIn = (event: FocusEvent) => {
      if (sheetRef.current?.contains(event.target as Node)) return
      focusFirstElement()
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocusIn)
    focusFirstElement()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', handleFocusIn)
      document.body.style.overflow = previousBodyOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  return (
    <div className={cn('fixed inset-0 z-[70] flex items-end justify-center bg-[rgba(2,6,23,0.55)]', visibleClassName)} onClick={onClose}>
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex max-h-[80dvh] w-full flex-col overflow-hidden rounded-t-md bg-slate-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        ref={sheetRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-center rounded-t-md bg-slate-900 px-4 py-4 text-white">
          <h4 className="text-sm font-bold text-white" id={titleId}>{title}</h4>
        </div>

        <div className={cn('flex-1 space-y-4 overflow-y-auto bg-white p-4', bodyClassName)}>{children}</div>

        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)_+_1rem)]">{footer}</div>
      </div>
    </div>
  )
}

```

## `apps/next/src/components/ui/PageSizeDropdown.tsx`

```tsx
'use client'

import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export function PageSizeDropdown({
  className,
  disabled = false,
  options = [10, 25, 50, 100],
  value,
  onChange,
}: {
  className?: string
  disabled?: boolean
  options?: readonly number[]
  value: number
  onChange: (value: number) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="จำนวนรายการต่อหน้า" className={`h-9 min-w-[92px] justify-between gap-2 px-3 font-normal focus-visible:ring-slate-400 focus-visible:ring-offset-0 ${className ?? ''}`.trim()} disabled={disabled} size="sm" type="button" variant="outline">
          <span>{value} / หน้า</span>
          <ChevronDown aria-hidden="true" className="size-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[116px]">
        {options.map((option) => (
          <DropdownMenuItem
            data-page-size-option=""
            key={option}
            onSelect={() => onChange(option)}
          >
            {option} / หน้า
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

```

## `apps/next/src/components/ui/ResizableTableHead.tsx`

```tsx
'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Triangle } from 'lucide-react'

type Align = 'center' | 'left' | 'right'
type SortDirection = 'asc' | 'desc'

export function ResizableTableHead<TSortKey extends string>({
  activeSortKey,
  align = 'left',
  className = '',
  direction,
  label,
  resizeProps,
  sortKey,
  onSort,
}: {
  activeSortKey?: TSortKey
  align?: Align
  className?: string
  direction?: SortDirection
  label: ReactNode
  onSort?: (key: TSortKey) => void
  resizeProps?: ButtonHTMLAttributes<HTMLButtonElement>
  sortKey?: TSortKey
}) {
  const alignClass = align === 'right' ? 'justify-end text-right' : align === 'center' ? 'justify-center text-center' : 'justify-start text-left'
  const active = Boolean(sortKey && activeSortKey === sortKey)
  const activeSortIconStyle = { color: 'var(--ns-sort-active)' }
  const content = (
    <>
      <span className="min-w-0 whitespace-nowrap leading-snug">{label}</span>
      {sortKey ? (
        <span aria-hidden="true" className="flex h-5 w-3 shrink-0 flex-col items-center justify-center gap-0.5 leading-none">
          <Triangle className={`size-2.5 fill-current stroke-none ${active && direction === 'asc' ? '' : 'text-slate-400'}`} style={active && direction === 'asc' ? activeSortIconStyle : undefined} />
          <Triangle className={`size-2.5 rotate-180 fill-current stroke-none ${active && direction === 'desc' ? '' : 'text-slate-400'}`} style={active && direction === 'desc' ? activeSortIconStyle : undefined} />
        </span>
      ) : null}
    </>
  )
  const contentPaddingClass = align === 'right' ? 'p-2 pr-3' : 'p-2 pr-4'

  return (
    <th
      aria-sort={sortKey ? (active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
      data-resizable-table-head=""
      className={`relative bg-inherit p-0 text-xs font-semibold text-slate-700 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${className}`}
    >
      {sortKey && onSort ? (
        <button className={`flex w-full min-w-0 items-center gap-1.5 hover:bg-slate-200 ${contentPaddingClass} ${alignClass}`} type="button" onClick={() => onSort(sortKey)}>
          {content}
        </button>
      ) : (
        <div className={`flex min-w-0 items-center gap-1.5 ${contentPaddingClass} ${alignClass}`}>
          {content}
        </div>
      )}
      {resizeProps ? (
        <button
          {...resizeProps}
          className="group absolute right-0 top-0 bottom-0 w-3 cursor-col-resize touch-none focus:outline-none"
          type="button"
        >
          <div className="absolute right-1 top-2.5 bottom-2.5 w-[1px] bg-slate-300 opacity-0 transition group-hover:bg-slate-400 group-hover:opacity-100 group-focus-visible:opacity-100 group-active:bg-blue-600 group-active:opacity-100" />
        </button>
      ) : null}
    </th>
  )
}

```

## `apps/next/src/components/ui/tabs.tsx`

```tsx
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

```

## `apps/next/src/components/daily/WeightTicketAttachmentGrid.tsx`

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { recordImageDelivery } from '@/lib/client-image-delivery-telemetry'

export type WeightTicketAttachmentPreview = {
  fileName: string
  id: string
  rawValue: string
  url: string
}

function AttachmentImage({ file }: { file: WeightTicketAttachmentPreview }) {
  const startedAt = useRef(0)
  useEffect(() => {
    startedAt.current = performance.now()
  }, [])

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={file.fileName}
      className="h-full w-full object-cover"
      src={file.url}
      onError={() => recordImageDelivery({ outcome: 'error', startedAt: startedAt.current, url: file.url })}
      onLoad={() => recordImageDelivery({ outcome: 'loaded', startedAt: startedAt.current, url: file.url })}
    />
  )
}

export function WeightTicketAttachmentGrid({
  id,
  addLabel,
  disabled = false,
  emptyLabel,
  files,
  onAppend,
  onPreview,
  onRemove,
  noWrapper = false,
}: {
  id?: string
  addLabel: string
  disabled?: boolean
  emptyLabel: string
  files: WeightTicketAttachmentPreview[]
  onAppend: (files: FileList | null) => void
  onPreview: (file: WeightTicketAttachmentPreview) => void
  onRemove: (fileId: string) => void
  noWrapper?: boolean
}) {
  const content = (
    <div className="flex flex-wrap gap-3" id={id}>
      {files.map((file) => (
        <div className="w-28 min-w-0" key={file.id}>
          <button
            className="group relative block h-28 w-28 overflow-hidden rounded-md border border-slate-100 bg-white shadow-sm ring-1 ring-slate-100 hover:border-slate-400"
            disabled={!file.url}
            title={file.fileName}
            type="button"
            onClick={() => file.url ? onPreview(file) : undefined}
          >
            {file.url ? (
              <>
                <AttachmentImage file={file} />
                <span className="absolute inset-x-0 bottom-0 bg-slate-950/70 px-2 py-1.5 text-center text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                  เปิดรูปภาพ
                </span>
              </>
            ) : (
              <span className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-slate-400">รูปเดิม</span>
            )}
          </button>
          <div className="mt-2 truncate text-xs text-slate-600" title={file.fileName}>{file.fileName}</div>
          <button className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline" disabled={disabled} type="button" onClick={() => onRemove(file.id)}>
            <Trash2 className="h-3 w-3" />
            ลบ
          </button>
        </div>
      ))}
      <label className={cn(
        'flex h-28 w-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-center text-xs font-medium text-slate-500 shadow-sm hover:border-slate-400 hover:bg-slate-50',
        disabled ? 'cursor-not-allowed opacity-60 hover:border-slate-300 hover:bg-white' : 'cursor-pointer',
      )}>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
          <ImagePlus className="h-5 w-5" />
        </span>
        {files.length === 0 ? emptyLabel : addLabel}
        <input
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={disabled}
          multiple
          type="file"
          onChange={(event) => {
            onAppend(event.target.files)
            event.target.value = ''
          }}
        />
      </label>
    </div>
  )

  return noWrapper ? content : (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
      {content}
    </div>
  )
}

```
