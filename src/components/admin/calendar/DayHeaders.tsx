import { isSameDay } from 'date-fns'
import { cn } from '@/lib/utils'

const DAYS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] // Lun–Dom

interface DayHeadersProps {
  year: number
  month: number
  daysInMonth: number
  today: Date
  colWidth: number
}

export function DayHeaders({ year, month, daysInMonth, today, colWidth }: DayHeadersProps) {
  return (
    <div className="flex">
      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
        const date = new Date(year, month, day)
        const isToday = isSameDay(date, today)
        const dayOfWeek = (date.getDay() + 6) % 7 // 0=Lun, 6=Dom
        const isWeekend = dayOfWeek >= 5

        return (
          <div
            key={day}
            style={{ width: colWidth, minWidth: colWidth }}
            className={cn(
              'flex flex-col items-center justify-center py-2 border-r border-slate-100 select-none',
              isToday
                ? 'bg-indigo-500 text-white'
                : isWeekend
                ? 'bg-slate-50 text-slate-500'
                : 'bg-white text-slate-500'
            )}
          >
            <span className="text-[10px] opacity-70">{DAYS_ES[dayOfWeek]}</span>
            <span className="text-xs font-semibold">{day}</span>
          </div>
        )
      })}
    </div>
  )
}
