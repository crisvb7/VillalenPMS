'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StatusBadge, SourceBadge } from '@/components/ui/Badge'
import { formatDate, formatCurrency, calculateNights } from '@/lib/utils'
import type { BookingWithRelations } from '@/types'
import { Check, X, ChevronDown, FileText, Euro } from 'lucide-react'

interface BookingsTableProps {
  bookings: BookingWithRelations[]
}

export function BookingsTable({ bookings }: BookingsTableProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function updateStatus(id: string, status: string) {
    setLoadingId(id)
    try {
      await fetch(`/api/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      router.refresh()
    } finally {
      setLoadingId(null)
    }
  }

  async function toggleDeposit(id: string, current: boolean) {
    setLoadingId(id)
    try {
      await fetch(`/api/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositPaid: !current }),
      })
      router.refresh()
    } finally {
      setLoadingId(null)
    }
  }

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
        <FileText className="mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">No hay reservas que mostrar</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50">
          <tr>
            {['Huésped', 'Habitación', 'Entrada', 'Salida', 'Noches', 'Total', 'Estado', 'Canal', 'Señal', 'Acciones'].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide"
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {bookings.map((b) => {
            const nights = calculateNights(b.checkInDate, b.checkOutDate)
            const isLoading = loadingId === b.id
            return (
              <tr key={b.id} className="group hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-3.5">
                  <p className="text-sm font-semibold text-slate-800">
                    {b.guest.firstName} {b.guest.lastName}
                  </p>
                  <p className="text-xs text-slate-400">{b.guest.email}</p>
                </td>
                <td className="px-4 py-3.5">
                  <p className="text-sm text-slate-700">{b.room.name}</p>
                  <p className="text-xs text-slate-400">{b.room.capacity} personas</p>
                </td>
                <td className="px-4 py-3.5 text-sm text-slate-700">{formatDate(b.checkInDate)}</td>
                <td className="px-4 py-3.5 text-sm text-slate-700">{formatDate(b.checkOutDate)}</td>
                <td className="px-4 py-3.5 text-sm font-medium text-slate-700">{nights}</td>
                <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">{formatCurrency(b.totalAmount)}</td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={b.status} />
                </td>
                <td className="px-4 py-3.5">
                  <SourceBadge source={b.source} />
                </td>
                <td className="px-4 py-3.5">
                  <button
                    onClick={() => toggleDeposit(b.id, b.depositPaid)}
                    disabled={isLoading}
                    title={b.depositPaid ? 'Señal recibida' : 'Sin señal'}
                    className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors ${
                      b.depositPaid
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    <Euro className="h-3 w-3" />
                    {b.depositPaid ? 'Pagada' : 'Pendiente'}
                  </button>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {b.status === 'PENDING' && (
                      <button
                        onClick={() => updateStatus(b.id, 'CONFIRMED')}
                        disabled={isLoading}
                        className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" /> Confirmar
                      </button>
                    )}
                    {b.status === 'CONFIRMED' && (
                      <button
                        onClick={() => updateStatus(b.id, 'CHECKED_IN')}
                        disabled={isLoading}
                        className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" /> Check-in
                      </button>
                    )}
                    {b.status === 'CHECKED_IN' && (
                      <button
                        onClick={() => updateStatus(b.id, 'CHECKED_OUT')}
                        disabled={isLoading}
                        className="flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        <ChevronDown className="h-3 w-3" /> Check-out
                      </button>
                    )}
                    {b.status !== 'CANCELLED' && b.status !== 'CHECKED_OUT' && (
                      <button
                        onClick={() => updateStatus(b.id, 'CANCELLED')}
                        disabled={isLoading}
                        className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" /> Cancelar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
