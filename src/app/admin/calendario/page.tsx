import { HotelCalendar } from '@/components/admin/HotelCalendar'
import { CalendarDays } from 'lucide-react'

export const metadata = { title: 'Calendario · PMS' }

export default function CalendarioPage() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <CalendarDays className="h-6 w-6 text-indigo-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Calendario de ocupación</h1>
          <p className="mt-0.5 text-sm text-slate-500">Vista mensual de todas las reservas por habitación</p>
        </div>
      </div>

      <HotelCalendar />
    </div>
  )
}
