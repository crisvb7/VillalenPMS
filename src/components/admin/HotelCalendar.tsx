'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Check, LogIn, LogOut } from 'lucide-react'
import { format, getDaysInMonth, isSameDay, isWithinInterval, addDays } from 'date-fns'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/Badge'
import { NewBookingModal } from './NewBookingModal'
import type { BookingWithRelations } from '@/types'

const STATUS_BG: Record<string, string> = {
  PENDING: 'bg-amber-400 hover:bg-amber-500',
  CONFIRMED: 'bg-emerald-500 hover:bg-emerald-600',
  CHECKED_IN: 'bg-blue-500 hover:bg-blue-600',
  CHECKED_OUT: 'bg-slate-400 hover:bg-slate-500',
  CANCELLED: 'bg-red-400',
}

interface Room { id: string; name: string }

interface Popover {
  booking: BookingWithRelations
  x: number
  y: number
}

export function HotelCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [rooms, setRooms] = useState<Room[]>([])
  const [bookings, setBookings] = useState<BookingWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [popover, setPopover] = useState<Popover | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDefaults, setModalDefaults] = useState<{ roomId?: string; checkIn?: string; checkOut?: string }>({})

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(currentDate)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const today = new Date()

  const load = useCallback(async () => {
    setLoading(true)
    const from = new Date(year, month, 1).toISOString()
    const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
    const [r, b] = await Promise.all([
      fetch('/api/rooms').then((r) => r.json()),
      fetch(`/api/bookings?from=${from}&to=${to}`).then((r) => r.json()),
    ])
    setRooms(r)
    setBookings(b)
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  // Close popover on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopover(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function getBookingForDay(roomId: string, day: number): BookingWithRelations | undefined {
    const date = new Date(year, month, day)
    return bookings.find(
      (b) =>
        b.roomId === roomId &&
        b.status !== 'CANCELLED' &&
        isWithinInterval(date, {
          start: new Date(b.checkInDate),
          end: addDays(new Date(b.checkOutDate), -1),
        })
    )
  }

  function handleCellClick(e: React.MouseEvent, roomId: string, day: number) {
    const booking = getBookingForDay(roomId, day)
    if (booking) {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      setPopover({ booking, x: rect.left, y: rect.bottom + 8 })
    } else {
      const checkIn = new Date(year, month, day).toISOString().split('T')[0]
      const checkOut = new Date(year, month, day + 1).toISOString().split('T')[0]
      setModalDefaults({ roomId, checkIn, checkOut })
      setModalOpen(true)
    }
  }

  async function updateBookingStatus(id: string, status: string) {
    setUpdatingId(id)
    try {
      await fetch(`/api/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setPopover(null)
      await load()
    } finally {
      setUpdatingId(null)
    }
  }

  const DAYS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  const firstDayOfMonth = new Date(year, month, 1).getDay()

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3">
          <h2 className="text-sm font-bold capitalize text-slate-800">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {Object.entries({ PENDING: 'Pendiente', CONFIRMED: 'Confirmada', CHECKED_IN: 'En casa', CHECKED_OUT: 'Finalizada' }).map(
                ([s, label]) => (
                  <span key={s} className="hidden items-center gap-1 text-xs text-slate-500 sm:flex">
                    <span className={cn('h-2.5 w-2.5 rounded-sm', STATUS_BG[s].split(' ')[0])} />
                    {label}
                  </span>
                )
              )}
            </div>
            <div className="flex gap-1 border-l border-slate-200 pl-3">
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                Hoy
              </button>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-sm text-slate-400">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </div>
          ) : (
            <table className="w-full border-collapse text-xs select-none">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-[160px] bg-slate-50 px-4 py-2.5 text-left text-xs font-semibold text-slate-500 border-b border-slate-100">
                    Habitación
                  </th>
                  {days.map((d) => {
                    const date = new Date(year, month, d)
                    const isToday = isSameDay(date, today)
                    const dayOfWeek = (date.getDay() + 6) % 7
                    const isWeekend = dayOfWeek >= 5
                    return (
                      <th
                        key={d}
                        className={cn(
                          'w-8 min-w-[32px] border-b border-slate-100 py-2 text-center font-medium',
                          isToday ? 'bg-indigo-500 text-white rounded-t' : isWeekend ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-500'
                        )}
                      >
                        <div className="text-[10px] font-normal opacity-70">{DAYS_ES[dayOfWeek]}</div>
                        <div>{d}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rooms.map((room) => (
                  <tr key={room.id}>
                    <td className="sticky left-0 z-10 bg-white px-4 py-0 border-r border-slate-100">
                      <span className="text-sm font-semibold text-slate-700">{room.name}</span>
                    </td>
                    {days.map((d) => {
                      const booking = getBookingForDay(room.id, d)
                      const date = new Date(year, month, d)
                      const isToday = isSameDay(date, today)
                      const isStart = booking && isSameDay(new Date(booking.checkInDate), date)
                      const isEnd = booking && isSameDay(addDays(new Date(booking.checkOutDate), -1), date)

                      return (
                        <td
                          key={d}
                          onClick={(e) => handleCellClick(e, room.id, d)}
                          className={cn(
                            'relative h-10 w-8 cursor-pointer p-0 transition-colors group',
                            !booking && 'hover:bg-indigo-50',
                            isToday && !booking && 'bg-indigo-50/40'
                          )}
                        >
                          {booking ? (
                            <div
                              className={cn(
                                'absolute inset-y-1 left-0 right-0 transition-opacity',
                                STATUS_BG[booking.status] ?? 'bg-slate-400',
                                isStart && 'left-1 rounded-l-full',
                                isEnd && 'right-1 rounded-r-full'
                              )}
                            >
                              {isStart && (
                                <span className="absolute inset-0 flex items-center pl-2 text-[10px] font-semibold text-white truncate pr-1">
                                  {booking.guest.firstName}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="h-3 w-3 text-indigo-400" />
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Booking popover */}
      {popover && (
        <div
          ref={popoverRef}
          style={{ position: 'fixed', left: Math.min(popover.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 320), top: popover.y, zIndex: 100 }}
          className="w-72 rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-start justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-slate-800">
                {popover.booking.guest.firstName} {popover.booking.guest.lastName}
              </p>
              <p className="text-xs text-slate-500">{popover.booking.room.name}</p>
            </div>
            <button onClick={() => setPopover(null)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Entrada</span>
              <span className="font-medium">{formatDate(popover.booking.checkInDate)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Salida</span>
              <span className="font-medium">{formatDate(popover.booking.checkOutDate)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Total</span>
              <span className="font-bold text-slate-800">{formatCurrency(popover.booking.totalAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Estado</span>
              <StatusBadge status={popover.booking.status} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-4 py-3">
            {popover.booking.status === 'PENDING' && (
              <button
                onClick={() => updateBookingStatus(popover.booking.id, 'CONFIRMED')}
                disabled={updatingId === popover.booking.id}
                className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                <Check className="h-3 w-3" /> Confirmar
              </button>
            )}
            {popover.booking.status === 'CONFIRMED' && (
              <button
                onClick={() => updateBookingStatus(popover.booking.id, 'CHECKED_IN')}
                disabled={updatingId === popover.booking.id}
                className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                <LogIn className="h-3 w-3" /> Check-in
              </button>
            )}
            {popover.booking.status === 'CHECKED_IN' && (
              <button
                onClick={() => updateBookingStatus(popover.booking.id, 'CHECKED_OUT')}
                disabled={updatingId === popover.booking.id}
                className="flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                <LogOut className="h-3 w-3" /> Check-out
              </button>
            )}
            {!['CANCELLED', 'CHECKED_OUT'].includes(popover.booking.status) && (
              <button
                onClick={() => updateBookingStatus(popover.booking.id, 'CANCELLED')}
                disabled={updatingId === popover.booking.id}
                className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <X className="h-3 w-3" /> Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      <NewBookingModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); load() }}
        defaultRoomId={modalDefaults.roomId}
        defaultCheckIn={modalDefaults.checkIn}
        defaultCheckOut={modalDefaults.checkOut}
      />
    </>
  )
}
