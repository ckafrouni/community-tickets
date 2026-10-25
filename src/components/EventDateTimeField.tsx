import { format } from 'date-fns'
import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import { Field, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover'

const DEFAULT_TIME = '18:00'

function toDate(day: string): Date | undefined {
  const [year, month, date] = day.split('-').map(Number)
  return year ? new Date(year, month - 1, date) : undefined
}

export function EventDateTimeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [day = '', time = ''] = value ? value.split('T') : []
  const date = toDate(day)

  return (
    <FieldGroup className="flex-row gap-3">
      <Field className="min-w-0 flex-1">
        <FieldLabel htmlFor="event-date">Date</FieldLabel>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={<Button variant="outline" id="event-date" className="w-full justify-between font-normal" />}
          >
            {date ? format(date, 'EEE, MMM d, yyyy') : 'Select date'}
            <ChevronDownIcon data-icon="inline-end" />
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              captionLayout="dropdown"
              defaultMonth={date}
              startMonth={new Date(new Date().getFullYear() - 1, 0)}
              endMonth={new Date(new Date().getFullYear() + 5, 11)}
              onSelect={(selected) => {
                onChange(selected ? `${format(selected, 'yyyy-MM-dd')}T${time || DEFAULT_TIME}` : '')
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </Field>
      <Field className="w-32 shrink-0">
        <FieldLabel htmlFor="event-time">Time</FieldLabel>
        <Input
          type="time"
          id="event-time"
          disabled={!day}
          value={time}
          onChange={(e) => onChange(`${day}T${e.target.value || DEFAULT_TIME}`)}
          className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
      </Field>
    </FieldGroup>
  )
}
