'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Search, UserPlus, User, Calendar, BedDouble, Euro, StickyNote } from 'lucide-react'
import { cn, formatCurrency, calculateNights } from '@/lib/utils'
import type { Room, Guest, BookingSource } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  defaultRoomId?: string
  defaultCheckIn?: string
  defaultCheckOut?: string
}

type GuestMode = 'search' | 'selected' | 'new'

const SOURCES: { value: BookingSource; label: string }[] = [
  { value: 'WEB', label: 'Web propia' },
  { value: 'BOOKING', label: 'Booking.com' },
  { value: 'AIRBNB', label: 'Airbnb' },
  { value: 'MANUAL', label: 'Teléfono / Walk-in' },
]

export function NewBookingModal({ open, onClose, defaultRoomId, defaultCheckIn, defaultCheckOut }: Props) {
  const router = useRouter()
  const searchRef = useRef<HTMLInputElement>(null)

  const [rooms, setRooms] = useState<Room[]>([])
  const [roomId, setRoomId] = useState(defaultRoomId ?? '')
  const [checkIn, setCheckIn] = useState(defaultCheckIn ?? '')
  const [checkOut, setCheckOut] = useState(defaultCheckOut ?? '')
  const [source, setSource] = useState<BookingSource>('MANUAL')
  const [depositPaid, setDepositPaid] = useState(false)
  const [notes, setNotes] = useState('')

  const [guestMode, setGuestMode] = useState<GuestMode>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Guest[]>([])
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
  const [newGuest, setNewGuest] = useState({ firstName: '', lastName: '', documentId: '', email: '', phone: '' })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Sync defaults when they change (calendar click)
  useEffect(() => {
    if (defaultRoomId) setRoomId(defaultRoomId)
    if (defaultCheckIn) setCheckIn(defaultCheckIn)
    if (defaultCheckOut) setCheckOut(defaultCheckOut)
  }, [defaultRoomId, defaultCheckIn, defaultCheckOut])

  // Load rooms once
  useEffect(() => {
    if (!open) return
    fetch('/api/rooms').then((r) => r.json()).then(setRooms)
    setTimeout(() => searchRef.current?.focus(), 100)
  }, [open])

  // Guest search debounce
  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/guests?q=${encodeURIComponent(query)}`)
      setResults(await r.json())
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const selectedRoom = rooms.find((r) => r.id === roomId)
  const nights = checkIn && checkOut ? calculateNights(checkIn, checkOut) : 0
  const totalAmount = selectedRoom && nights > 0 ? Number(selectedRoom.basePrice) * nights : 0

  const today = new Date().toISOString().split('T')[0]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!roomId || !checkIn || !checkOut) { setError('Selecciona habitación y fechas'); return }
    if (nights <= 0) { setError('La salida debe ser posterior a la entrada'); return }
    if (guestMode === 'search' && !selectedGuest) { setError('Selecciona o crea un huésped'); return }
    if (guestMode === 'new' && (!newGuest.firstName || !newGuest.lastName || !newGuest.documentId || !newGuest.email)) {
      setError('Completa los datos del huésped')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      const body = {
        roomId, checkInDate: checkIn, checkOutDate: checkOut, source, notes, depositPaid,
        ...(guestMode === 'selected' ? { guestId: selectedGuest!.id } : {}),
        ...(guestMode === 'new' ? newGuest : {}),
      }
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.refresh()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear reserva')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setRoomId(defaultRoomId ?? '')
    setCheckIn(defaultCheckIn ?? '')
    setCheckOut(defaultCheckOut ?? '')
    setSource('MANUAL')
    setDepositPaid(false)
    setNotes('')
    setGuestMode('search')
    setQuery('')
    setResults([])
    setSelectedGuest(null)
    setNewGuest({ firstName: '', lastName: '', documentId: '', email: '', phone: '' })
    setError('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800">Nueva Reserva</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Room + Dates */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <BedDouble className="h-3.5 w-3.5" /> Habitación
              </label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">Seleccionar...</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.capacity} pax)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Calendar className="h-3.5 w-3.5" /> Entrada
              </label>
              <input
                type="date"
                value={checkIn}
                min={today}
                onChange={(e) => { setCheckIn(e.target.value); if (checkOut && e.target.value >= checkOut) setCheckOut('') }}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Calendar className="h-3.5 w-3.5" /> Salida
              </label>
              <input
                type="date"
                value={checkOut}
                min={checkIn || today}
                onChange={(e) => setCheckOut(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Price preview */}
          {totalAmount > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm">
              <Euro className="h-4 w-4 text-indigo-500" />
              <span className="text-indigo-700">
                {nights} {nights === 1 ? 'noche' : 'noches'} × {formatCurrency(selectedRoom!.basePrice)} ={' '}
                <strong>{formatCurrency(totalAmount)}</strong>
              </span>
            </div>
          )}

          {/* Guest section */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <User className="h-3.5 w-3.5" /> Huésped
            </label>

            {guestMode === 'selected' && selectedGuest ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-800">{selectedGuest.firstName} {selectedGuest.lastName}</p>
                  <p className="text-xs text-emerald-600">{selectedGuest.documentId} · {selectedGuest.email}</p>
                </div>
                <button type="button" onClick={() => { setGuestMode('search'); setSelectedGuest(null); setQuery('') }}
                  className="text-xs text-emerald-700 underline hover:no-underline">Cambiar</button>
              </div>
            ) : guestMode === 'new' ? (
              <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">Nuevo huésped</p>
                  <button type="button" onClick={() => setGuestMode('search')}
                    className="text-xs text-slate-500 underline hover:no-underline">Buscar existente</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Nombre *" value={newGuest.firstName}
                    onChange={(e) => setNewGuest((g) => ({ ...g, firstName: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                  <input placeholder="Apellidos *" value={newGuest.lastName}
                    onChange={(e) => setNewGuest((g) => ({ ...g, lastName: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <input placeholder="DNI / Pasaporte *" value={newGuest.documentId}
                  onChange={(e) => setNewGuest((g) => ({ ...g, documentId: e.target.value.toUpperCase() }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                <input type="email" placeholder="Email *" value={newGuest.email}
                  onChange={(e) => setNewGuest((g) => ({ ...g, email: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                <input type="tel" placeholder="Teléfono (opcional)" value={newGuest.phone}
                  onChange={(e) => setNewGuest((g) => ({ ...g, phone: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por nombre, DNI o email..."
                    className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                {(results.length > 0 || query.length >= 2) && (
                  <div className="absolute top-full z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                    {results.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => { setSelectedGuest(g); setGuestMode('selected'); setQuery('') }}
                        className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-slate-50"
                      >
                        <span className="text-sm font-medium text-slate-800">{g.firstName} {g.lastName}</span>
                        <span className="text-xs text-slate-500">{g.documentId} · {g.email}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setGuestMode('new')}
                      className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                    >
                      <UserPlus className="h-4 w-4" /> Crear nuevo huésped
                    </button>
                  </div>
                )}
                {query.length < 2 && (
                  <button
                    type="button"
                    onClick={() => setGuestMode('new')}
                    className="mt-2 flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline"
                  >
                    <UserPlus className="h-4 w-4" /> Crear nuevo huésped sin buscar
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Source + Deposit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Canal</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as BookingSource)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex cursor-pointer items-center gap-2.5">
                <div
                  onClick={() => setDepositPaid((v) => !v)}
                  className={cn(
                    'relative h-5 w-9 flex-shrink-0 rounded-full transition-colors cursor-pointer',
                    depositPaid ? 'bg-emerald-500' : 'bg-slate-200'
                  )}
                >
                  <div className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                    depositPaid ? 'translate-x-4' : 'translate-x-0.5')} />
                </div>
                <span className="text-sm text-slate-600">Señal / depósito recibido</span>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <StickyNote className="h-3.5 w-3.5" /> Notas internas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Alergias, peticiones especiales, procedencia..."
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 flex-shrink-0">
          <button onClick={handleClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Creando...' : totalAmount > 0 ? `Crear reserva · ${formatCurrency(totalAmount)}` : 'Crear reserva'}
          </button>
        </div>
      </div>
    </div>
  )
}
