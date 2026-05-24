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

function parseDate(value: string) {
  if (!value.trim()) return undefined
  const parsed = parse(value, 'yyyy-MM-dd', new Date())
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function DatePickerInput({
  className,
  id,
  placeholder = 'YYYY-MM-DD',
  showClearButton = true,
  showTodayButton = true,
  value,
  onChange,
}: {
  className?: string
  id: string
  placeholder?: string
  showClearButton?: boolean
  showTodayButton?: boolean
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const selectedDate = React.useMemo(() => parseDate(value), [value])
  const [month, setMonth] = React.useState<Date | undefined>(selectedDate)
  const [inputValue, setInputValue] = React.useState(value)

  React.useEffect(() => {
    setInputValue(value)
    const nextDate = parseDate(value)
    if (nextDate) setMonth(nextDate)
  }, [value])

  return (
    <InputGroup className={className ?? 'w-[130px]'}>
      <InputGroupInput
        id={id}
        value={inputValue}
        placeholder={placeholder}
        onChange={(event) => {
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
        onBlur={() => {
          const nextDate = parseDate(inputValue)
          if (nextDate) {
            const normalized = formatDate(nextDate)
            setInputValue(normalized)
            onChange(normalized)
            return
          }
          if (!inputValue.trim()) {
            onChange('')
            return
          }
          setInputValue(value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      />
      <InputGroupAddon align="inline-end">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <InputGroupButton aria-label="เลือกวันที่" size="icon" type="button" variant="ghost">
              <CalendarIcon className="h-4 w-4" />
              <span className="sr-only">Select date</span>
            </InputGroupButton>
          </PopoverTrigger>
          <PopoverContent align="end" alignOffset={-8} className="w-auto overflow-hidden p-0" sideOffset={10}>
            <Calendar
              mode="single"
              selected={selectedDate}
              month={month}
              onMonthChange={setMonth}
              onSelect={(date) => {
                const nextValue = formatDate(date)
                setInputValue(nextValue)
                onChange(nextValue)
                setOpen(false)
              }}
            />
            {showTodayButton || showClearButton ? (
              <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2">
                {showClearButton ? (
                  <button
                    className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
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
                    className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    type="button"
                    onClick={() => {
                      const today = formatDate(new Date())
                      setInputValue(today)
                      setMonth(new Date())
                      onChange(today)
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
