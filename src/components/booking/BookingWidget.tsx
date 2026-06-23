'use client'

import { useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { AvailabilityResult } from '@/types'
import {
  Calendar,
  Users,
  Search,
  CheckCircle2,
  ArrowLeft,
  BedDouble,
  Mail,
  Phone,
  User,
  CreditCard,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Step = 'dates' | 'rooms' | 'guest' | 'success'

interface BookingResult {
  id: string
  totalAmount: number
  room: { name: string }
  guest: { firstName: string; lastName: string; email: string }
  checkInDate: string
  checkOutDate: string
}

export function BookingWidget() {
  const [step, setStep] = useState<Step>('dates')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [results, setResults] = useState<AvailabilityResult[]>([])
  const [selected, setSelected] = useState<AvailabilityResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    documentId: '',
    email: '',
    phone: '',
  })

  const today = new Date().toISOString().split('T')[0]

  async function searchRooms(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSearching(true)
    try {
      const res = await fetch(`/api/availability?checkIn=${checkIn}&checkOut=${checkOut}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResults(data)
      setStep('rooms')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar disponibilidad')
    } finally {
      setSearching(false)
    }
  }

  function selectRoom(result: AvailabilityResult) {
    setSelected(result)
    setStep('guest')
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: selected.room.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          source: 'WEB',
          ...form,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBookingResult(data)
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la reserva')
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setStep('dates')
    setCheckIn('')
    setCheckOut('')
    setResults([])
    setSelected(null)
    setError('')
    setBookingResult(null)
    setForm({ firstName: '', lastName: '', documentId: '', email: '', phone: '' })
  }

  const StepIndicator = () => (
    <div className="mb-8 flex items-center justify-center gap-2">
      {(['dates', 'rooms', 'guest'] as Step[]).map((s, i) => {
        const steps: Step[] = ['dates', 'rooms', 'guest']
        const current = steps.indexOf(step)
        const idx = steps.indexOf(s)
        return (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                idx < current
                  ? 'bg-emerald-500 text-white'
                  : idx === current
                  ? 'bg-stone-800 text-white'
                  : 'bg-stone-200 text-stone-500'
              )}
            >
              {idx < current ? '✓' : i + 1}
            </div>
            {i < 2 && (
              <div className={cn('h-0.5 w-8', idx < current ? 'bg-emerald-500' : 'bg-stone-200')} />
            )}
          </div>
        )
      })}
    </div>
  )

  if (step === 'dates') {
    return (
      <div className="mx-auto max-w-2xl">
        <StepIndicator />
        <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-stone-200">
          <h2 className="mb-2 text-2xl font-bold text-stone-800">Consulta disponibilidad</h2>
          <p className="mb-6 text-stone-500">Selecciona tus fechas para ver las habitaciones disponibles</p>

          <form onSubmit={searchRooms} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-700">
                  <Calendar className="h-4 w-4" /> Fecha de entrada
                </label>
                <input
                  type="date"
                  value={checkIn}
                  min={today}
                  onChange={(e) => {
                    setCheckIn(e.target.value)
                    if (checkOut && e.target.value >= checkOut) setCheckOut('')
                  }}
                  required
                  className="w-full rounded-xl border-2 border-stone-200 px-4 py-3 text-sm font-medium text-stone-800 transition-colors focus:border-stone-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-700">
                  <Calendar className="h-4 w-4" /> Fecha de salida
                </label>
                <input
                  type="date"
                  value={checkOut}
                  min={checkIn || today}
                  onChange={(e) => setCheckOut(e.target.value)}
                  required
                  className="w-full rounded-xl border-2 border-stone-200 px-4 py-3 text-sm font-medium text-stone-800 transition-colors focus:border-stone-600 focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={searching}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-800 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-stone-700 disabled:opacity-60"
            >
              <Search className="h-4 w-4" />
              {searching ? 'Buscando...' : 'Buscar disponibilidad'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (step === 'rooms') {
    return (
      <div className="mx-auto max-w-3xl">
        <StepIndicator />
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => setStep('dates')}
            className="flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-800"
          >
            <ArrowLeft className="h-4 w-4" /> Cambiar fechas
          </button>
          <p className="text-sm text-stone-500">
            {formatDate(checkIn)} — {formatDate(checkOut)}
          </p>
        </div>

        {results.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow-xl ring-1 ring-stone-200">
            <BedDouble className="mx-auto mb-3 h-12 w-12 text-stone-300" />
            <p className="text-lg font-semibold text-stone-700">Sin disponibilidad</p>
            <p className="mt-1 text-sm text-stone-400">No hay habitaciones libres para esas fechas.</p>
            <button
              onClick={() => setStep('dates')}
              className="mt-4 rounded-xl bg-stone-800 px-6 py-2.5 text-sm font-semibold text-white hover:bg-stone-700"
            >
              Cambiar fechas
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {results.map(({ room, pricePerNight, totalNights, totalPrice }) => (
              <div
                key={room.id}
                className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl ring-1 ring-stone-200 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                    <BedDouble className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-stone-800">{room.name}</h3>
                    <p className="flex items-center gap-1.5 text-sm text-stone-500">
                      <Users className="h-3.5 w-3.5" />
                      Hasta {room.capacity} personas
                    </p>
                    <p className="mt-0.5 text-sm text-stone-500">
                      {formatCurrency(pricePerNight)}/noche · {totalNights}{' '}
                      {totalNights === 1 ? 'noche' : 'noches'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 sm:flex-shrink-0">
                  <p className="text-2xl font-extrabold text-stone-800">{formatCurrency(totalPrice)}</p>
                  <p className="text-xs text-stone-400">total, impuestos incluidos</p>
                  <button
                    onClick={() => selectRoom({ room, available: true, pricePerNight, totalNights, totalPrice })}
                    className="rounded-xl bg-stone-800 px-6 py-2.5 text-sm font-bold text-white hover:bg-stone-700 transition-colors"
                  >
                    Reservar esta habitación
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (step === 'guest') {
    return (
      <div className="mx-auto max-w-2xl">
        <StepIndicator />
        <button
          onClick={() => setStep('rooms')}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-800"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a habitaciones
        </button>

        <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-stone-200">
          <div className="mb-6 rounded-xl bg-stone-50 p-4">
            <p className="text-sm font-semibold text-stone-700">{selected?.room.name}</p>
            <p className="text-xs text-stone-500">
              {formatDate(checkIn)} → {formatDate(checkOut)} ·{' '}
              <span className="font-semibold text-stone-700">{formatCurrency(selected?.totalPrice ?? 0)}</span>
            </p>
          </div>

          <h2 className="mb-5 text-xl font-bold text-stone-800">Datos del huésped principal</h2>

          <form onSubmit={submitBooking} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-700">
                  <User className="h-3.5 w-3.5" /> Nombre
                </label>
                <input
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  required
                  placeholder="María"
                  className="w-full rounded-xl border-2 border-stone-200 px-4 py-2.5 text-sm focus:border-stone-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-700">
                  <User className="h-3.5 w-3.5" /> Apellidos
                </label>
                <input
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  required
                  placeholder="García López"
                  className="w-full rounded-xl border-2 border-stone-200 px-4 py-2.5 text-sm focus:border-stone-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-700">
                <CreditCard className="h-3.5 w-3.5" /> DNI / Pasaporte
              </label>
              <input
                value={form.documentId}
                onChange={(e) => setForm((f) => ({ ...f, documentId: e.target.value.toUpperCase() }))}
                required
                placeholder="12345678A"
                className="w-full rounded-xl border-2 border-stone-200 px-4 py-2.5 text-sm uppercase focus:border-stone-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-700">
                <Mail className="h-3.5 w-3.5" /> Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                placeholder="maria@ejemplo.com"
                className="w-full rounded-xl border-2 border-stone-200 px-4 py-2.5 text-sm focus:border-stone-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-700">
                <Phone className="h-3.5 w-3.5" /> Teléfono <span className="font-normal text-stone-400">(opcional)</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+34 600 000 000"
                className="w-full rounded-xl border-2 border-stone-200 px-4 py-2.5 text-sm focus:border-stone-600 focus:outline-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 p-4">
              <p className="text-xs text-stone-500">
                Al confirmar, recibirá un correo con las instrucciones de pago. El pago se realiza mediante
                <strong className="text-stone-700"> transferencia bancaria o TPV físico</strong> en el momento
                del check-in.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-800 px-6 py-3.5 text-sm font-bold text-white hover:bg-stone-700 disabled:opacity-60"
            >
              {submitting ? 'Procesando...' : `Confirmar reserva · ${formatCurrency(selected?.totalPrice ?? 0)}`}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (step === 'success' && bookingResult) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="rounded-2xl bg-white p-10 shadow-xl ring-1 ring-stone-200">
          <div className="mb-5 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-stone-800">¡Reserva realizada!</h2>
          <p className="mt-2 text-stone-500">Gracias, {bookingResult.guest.firstName}. Tu reserva está pendiente de confirmación de pago.</p>

          <div className="my-6 rounded-xl bg-stone-50 p-4 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Referencia</span>
              <span className="font-mono font-semibold text-stone-800">{bookingResult.id.slice(-8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Habitación</span>
              <span className="font-semibold text-stone-800">{bookingResult.room.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Entrada</span>
              <span className="font-semibold text-stone-800">{formatDate(bookingResult.checkInDate)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Salida</span>
              <span className="font-semibold text-stone-800">{formatDate(bookingResult.checkOutDate)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-stone-200 pt-2 mt-2">
              <span className="text-stone-500">Total</span>
              <span className="font-bold text-stone-900">{formatCurrency(bookingResult.totalAmount)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
            <p className="text-sm font-semibold text-amber-800">Instrucciones de pago</p>
            <p className="mt-1 text-xs text-amber-700">
              Recibirá un email en <strong>{bookingResult.guest.email}</strong> con las instrucciones para
              realizar el pago mediante transferencia bancaria. Su reserva quedará confirmada una vez
              recibamos el pago.
            </p>
          </div>

          <button
            onClick={reset}
            className="mt-6 rounded-xl border-2 border-stone-200 px-6 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            Realizar otra reserva
          </button>
        </div>
      </div>
    )
  }

  return null
}
