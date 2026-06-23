'use client'

import { useState } from 'react'
import { InvoicesTable } from '@/components/admin/InvoicesTable'
import { formatCurrency, formatDate, calculateNights } from '@/lib/utils'
import { Plus, X, FileText } from 'lucide-react'
import type { InvoiceWithRelations } from '@/types'
import type { Booking, Guest, Room } from '@/types'

type BookingWithDetails = Booking & { guest: Guest; room: Room }

interface Props {
  initialInvoices: InvoiceWithRelations[]
  bookingsWithoutInvoice: BookingWithDetails[]
}

export function InvoicesPageClient({ initialInvoices, bookingsWithoutInvoice }: Props) {
  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>(initialInvoices)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [creating, setCreating] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = statusFilter === 'all'
    ? invoices
    : invoices.filter((i) => i.status === statusFilter)

  async function refresh() {
    const res = await fetch('/api/invoices')
    if (res.ok) setInvoices(await res.json())
  }

  async function createInvoice() {
    if (!selectedBookingId) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: selectedBookingId, notes }),
      })
      if (!res.ok) {
        const e = await res.json()
        setError(e.error ?? 'Error al crear factura')
        return
      }
      setCreating(false)
      setSelectedBookingId('')
      setNotes('')
      await refresh()
    } finally {
      setSubmitting(false)
    }
  }

  const FILTERS = [
    { value: 'all', label: 'Todas' },
    { value: 'DRAFT', label: 'Borradores' },
    { value: 'ISSUED', label: 'Emitidas' },
    { value: 'PAID', label: 'Cobradas' },
    { value: 'CANCELLED', label: 'Anuladas' },
  ]

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
              style={statusFilter === value
                ? { background: '#163300', color: '#fff' }
                : { background: '#f1f5f9', color: '#64748b' }
              }
            >
              {label}
              {value !== 'all' && (
                <span className="ml-1 opacity-60">
                  ({invoices.filter((i) => i.status === value).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {bookingsWithoutInvoice.length > 0 && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors"
            style={{ background: '#163300' }}
          >
            <Plus className="h-4 w-4" />
            Nueva factura
          </button>
        )}
      </div>

      {/* Invoice table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <InvoicesTable invoices={filtered} onRefresh={refresh} />
      </div>

      {/* Create invoice modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" style={{ color: '#163300' }} />
                <h3 className="text-base font-bold text-slate-800">Emitir nueva factura</h3>
              </div>
              <button onClick={() => { setCreating(false); setError(null) }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Seleccionar reserva
                </label>
                <select
                  value={selectedBookingId}
                  onChange={(e) => setSelectedBookingId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-[#163300] focus:outline-none focus:ring-1 focus:ring-[#163300]"
                >
                  <option value="">— Selecciona una reserva —</option>
                  {bookingsWithoutInvoice.map((b) => {
                    const nights = calculateNights(b.checkInDate, b.checkOutDate)
                    return (
                      <option key={b.id} value={b.id}>
                        {b.guest.firstName} {b.guest.lastName} · {b.room.name} · {nights}n · {formatDate(b.checkInDate)}
                      </option>
                    )
                  })}
                </select>
              </div>

              {selectedBookingId && (() => {
                const b = bookingsWithoutInvoice.find((x) => x.id === selectedBookingId)!
                const nights = calculateNights(b.checkInDate, b.checkOutDate)
                const total = Number(b.totalAmount)
                const tax = total - total / 1.1
                return (
                  <div className="rounded-xl p-4 text-sm space-y-2" style={{ background: '#edfce5' }}>
                    <div className="flex justify-between text-slate-600">
                      <span>Huésped</span>
                      <span className="font-medium text-slate-800">{b.guest.firstName} {b.guest.lastName}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Habitación</span>
                      <span className="font-medium text-slate-800">{b.room.name} · {nights} noches</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Base imponible</span>
                      <span className="font-medium">{formatCurrency(total - tax)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>IVA (10%)</span>
                      <span className="font-medium">{formatCurrency(tax)}</span>
                    </div>
                    <div className="flex justify-between border-t border-[#9FE870] pt-2 font-bold" style={{ color: '#163300' }}>
                      <span>Total factura</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                )
              })()}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Notas (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 resize-none focus:border-[#163300] focus:outline-none focus:ring-1 focus:ring-[#163300]"
                  placeholder="Observaciones en la factura..."
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>

            <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => { setCreating(false); setError(null) }}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={createInvoice}
                disabled={!selectedBookingId || submitting}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors"
                style={{ background: '#163300' }}
              >
                {submitting ? 'Emitiendo…' : 'Emitir factura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
