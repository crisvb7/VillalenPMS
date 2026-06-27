'use client'

import { useEffect } from 'react'
import { X, LogIn, LogOut, Check, ExternalLink } from 'lucide-react'
import { cn, formatDate, formatCurrency, calculateNights } from '@/lib/utils'
import { StatusBadge, SourceBadge } from '@/components/ui/Badge'
import type { BookingWithRelations } from '@/types'

interface BookingSlideOverProps {
  booking: BookingWithRelations | null
  onClose: () => void
  onStatusChange: (id: string, status: string) => Promise<void>
  updatingId: string | null
}

export function BookingSlideOver({ booking, onClose, onStatusChange, updatingId }: BookingSlideOverProps) {
  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (booking) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [booking, onClose])

  const isUpdating = updatingId === booking?.id

  return (
    <div className={cn('fixed inset-0 z-50 flex justify-end', !booking && 'pointer-events-none')}>
      {/* Overlay */}
      <div
        className={cn(
          'absolute inset-0 bg-black/30 transition-opacity duration-200',
          booking ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'relative z-10 flex h-full w-[380px] flex-col bg-white shadow-2xl transition-transform duration-200 ease-out',
          booking ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {booking && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 p-6">
              <div>
                <p className="text-lg font-bold text-slate-900">
                  {booking.guest.firstName} {booking.guest.lastName}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">{booking.room.name}</p>
                <div className="mt-2">
                  <StatusBadge status={booking.status} />
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Details */}
            <div className="flex-1 overflow-y-auto p-6">
              <dl className="space-y-3">
                {[
                  ['Entrada',  formatDate(booking.checkInDate)],
                  ['Salida',   formatDate(booking.checkOutDate)],
                  ['Noches',   String(calculateNights(booking.checkInDate, booking.checkOutDate))],
                  ['Total',    formatCurrency(booking.totalAmount)],
                  ['Depósito', booking.depositPaid ? '✓ Pagado' : '✗ Pendiente'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between">
                    <dt className="text-sm text-slate-500">{label}</dt>
                    <dd className="text-sm font-semibold text-slate-800">{value}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-slate-500">Origen</dt>
                  <dd><SourceBadge source={booking.source} /></dd>
                </div>
                {booking.notes && (
                  <div className="pt-1">
                    <dt className="mb-1 text-sm text-slate-500">Notas</dt>
                    <dd className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{booking.notes}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Actions */}
            <div className="border-t border-slate-100 p-6 space-y-2">
              {booking.status === 'PENDING' && (
                <button
                  onClick={() => onStatusChange(booking.id, 'CONFIRMED')}
                  disabled={isUpdating}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                >
                  <Check className="h-4 w-4" />
                  Confirmar reserva
                </button>
              )}
              {booking.status === 'CONFIRMED' && (
                <button
                  onClick={() => onStatusChange(booking.id, 'CHECKED_IN')}
                  disabled={isUpdating}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                >
                  <LogIn className="h-4 w-4" />
                  Registrar check-in
                </button>
              )}
              {booking.status === 'CHECKED_IN' && (
                <button
                  onClick={() => onStatusChange(booking.id, 'CHECKED_OUT')}
                  disabled={isUpdating}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Registrar check-out
                </button>
              )}
              {!['CANCELLED', 'CHECKED_OUT'].includes(booking.status) && (
                <button
                  onClick={() => onStatusChange(booking.id, 'CANCELLED')}
                  disabled={isUpdating}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Cancelar reserva
                </button>
              )}
              <a
                href="/admin/reservas"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Ver reserva completa
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
