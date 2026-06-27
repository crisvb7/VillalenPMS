import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

const STATUS_LEGEND = [
  { key: 'PENDING',    label: 'Pendiente',  color: 'bg-amber-400'  },
  { key: 'CONFIRMED',  label: 'Confirmada', color: 'bg-emerald-500' },
  { key: 'CHECKED_IN', label: 'En casa',    color: 'bg-blue-500'   },
  { key: 'CHECKED_OUT',label: 'Finalizada', color: 'bg-slate-400'  },
] as const

interface CalendarHeaderProps {
  currentDate: Date
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
}

export function CalendarHeader({ currentDate, onPrevMonth, onNextMonth, onToday }: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3">
      <h2 className="text-sm font-bold capitalize text-slate-800">
        {format(currentDate, 'MMMM yyyy')}
      </h2>
      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-3 sm:flex">
          {STATUS_LEGEND.map(({ key, label, color }) => (
            <span key={key} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
              {label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1 border-l border-slate-200 pl-4">
          <button
            onClick={onPrevMonth}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={onToday}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={onNextMonth}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
