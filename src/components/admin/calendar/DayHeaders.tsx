import { isSameDay, addDays, format } from 'date-fns'
import { cn } from '@/lib/utils'

const DAYS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

interface DayHeadersProps {
  startDate: Date
  windowSize: number
  today: Date
  colWidth: number
}

export function DayHeaders({ startDate, windowSize, today, colWidth }: DayHeadersProps) {
  return (
    <div className="flex">
      {Array.from({ length: windowSize }, (_, i) => i).map((offset) => {
        const date = addDays(startDate, offset)
        const isToday = isSameDay(date, today)
        const dayOfWeek = (date.getDay() + 6) % 7
        const isWeekend = dayOfWeek >= 5
        const isFirstOfMonth = date.getDate() === 1

        return (
          <div
            key={offset}
            style={{ width: colWidth, minWidth: colWidth }}
            className={cn(
              'flex flex-col items-center justify-center py-1 border-r border-slate-100 select-none',
              isToday
                ? 'bg-indigo-500 text-white'
                : isWeekend
                ? 'bg-slate-50 text-slate-500'
                : 'bg-white text-slate-500'
            )}
          >
            {isFirstOfMonth && (
              <span className="text-[8px] font-bold uppercase opacity-60">
                {format(date, 'MMM')}
              </span>
            )}
            <span className="text-[10px] opacity-70">{DAYS_ES[dayOfWeek]}</span>
            <span className="text-xs font-semibold">{date.getDate()}</span>
          </div>
        )
      })}
    </div>
  )
}
