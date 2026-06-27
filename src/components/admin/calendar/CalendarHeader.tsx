import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getMonth, getYear, getDaysInMonth } from 'date-fns'

const STATUS_LEGEND = [
  { key: 'PENDING',    label: 'Pendiente',  color: 'bg-amber-400'  },
  { key: 'CONFIRMED',  label: 'Confirmada', color: 'bg-emerald-500' },
  { key: 'CHECKED_IN', label: 'En casa',    color: 'bg-blue-500'   },
  { key: 'CHECKED_OUT',label: 'Finalizada', color: 'bg-slate-400'  },
] as const

const MONTHS_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const YEARS = Array.from({ length: 6 }, (_, i) => 2024 + i)

interface CalendarHeaderProps {
  startDate: Date
  onPrevDay: () => void
  onNextDay: () => void
  onToday: () => void
  onMonthYearChange: (year: number, month: number) => void
}

export function CalendarHeader({
  startDate, onPrevDay, onNextDay, onToday, onMonthYearChange,
}: CalendarHeaderProps) {
  const currentMonth = getMonth(startDate)
  const currentYear  = getYear(startDate)

  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3">
      <div className="flex items-center gap-2">
        <select
          value={currentMonth}
          onChange={(e) => onMonthYearChange(currentYear, Number(e.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {MONTHS_ES.map((name, idx) => (
            <option key={idx} value={idx}>{name}</option>
          ))}
        </select>
        <select
          value={currentYear}
          onChange={(e) => onMonthYearChange(Number(e.target.value), currentMonth)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <span className="ml-1 text-xs text-slate-400">
          ({getDaysInMonth(startDate)} días)
        </span>
      </div>

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
            onClick={onPrevDay}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
            title="Día anterior"
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
            onClick={onNextDay}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
            title="Día siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
