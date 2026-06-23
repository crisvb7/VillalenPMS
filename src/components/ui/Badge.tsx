import { cn } from '@/lib/utils'
import type { BookingStatus, BookingSource } from '@/types'

const statusConfig: Record<BookingStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pendiente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  CONFIRMED: { label: 'Confirmada', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  CHECKED_IN: { label: 'En casa', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  CHECKED_OUT: { label: 'Finalizada', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  CANCELLED: { label: 'Cancelada', className: 'bg-red-100 text-red-700 border-red-200' },
}

const sourceConfig: Record<BookingSource, { label: string; className: string }> = {
  WEB: { label: 'Web', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  BOOKING: { label: 'Booking.com', className: 'bg-sky-100 text-sky-800 border-sky-200' },
  AIRBNB: { label: 'Airbnb', className: 'bg-rose-100 text-rose-800 border-rose-200' },
  MANUAL: { label: 'Manual', className: 'bg-slate-100 text-slate-700 border-slate-200' },
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const config = statusConfig[status]
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  )
}

export function SourceBadge({ source }: { source: BookingSource }) {
  const config = sourceConfig[source]
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  )
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border', className)}>
      {children}
    </span>
  )
}
