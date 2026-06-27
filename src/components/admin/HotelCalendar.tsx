'use client'

import { useState, useEffect, useCallback } from 'react'
import { getDaysInMonth, differenceInCalendarDays, addDays } from 'date-fns'
import { CalendarHeader } from './calendar/CalendarHeader'
import { CalendarGrid } from './calendar/CalendarGrid'
import { BookingSlideOver } from './calendar/BookingSlideOver'
import { Toast, type ToastData } from '@/components/ui/Toast'
import { NewBookingModal } from './NewBookingModal'
import type { BookingWithRelations } from '@/types'
import type { GhostBar } from './calendar/RoomRow'

interface Room { id: string; name: string }

interface DragState {
  bookingId: string
  offsetDays: number
}

export function HotelCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [rooms, setRooms] = useState<Room[]>([])
  const [bookings, setBookings] = useState<BookingWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBooking, setSelectedBooking] = useState<BookingWithRelations | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [ghostBar, setGhostBar] = useState<GhostBar | null>(null)
  const [toasts, setToasts] = useState<ToastData[]>([])
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDefaults, setModalDefaults] = useState<{ roomId?: string; checkIn?: string; checkOut?: string }>({})

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(currentDate)
  const today = new Date()

  const load = useCallback(async () => {
    setLoading(true)
    const from = new Date(year, month, 1).toISOString()
    const to   = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
    const [r, b] = await Promise.all([
      fetch('/api/rooms').then((res) => res.json()),
      fetch(`/api/bookings?from=${from}&to=${to}`).then((res) => res.json()),
    ])
    setRooms(r)
    setBookings(b)
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  // --- Toast helpers ---
  function addToast(type: 'success' | 'error', message: string) {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, type, message }])
  }
  function removeToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  // Stable close handler — prevents Escape listener from re-registering every render
  const handleSlideOverClose = useCallback(() => {
    setSelectedBooking(null)
  }, [])

  // --- Drag handlers ---
  function handleDragStart(booking: BookingWithRelations, offsetDays: number) {
    setDragState({ bookingId: booking.id, offsetDays })
  }

  function handleDragOver(e: React.DragEvent, roomId: string, day: number) {
    e.preventDefault()
    if (!dragState) return
    const booking = bookings.find((b) => b.id === dragState.bookingId)
    if (!booking) return

    const newCheckIn  = new Date(year, month, day - dragState.offsetDays)
    const nights      = differenceInCalendarDays(new Date(booking.checkOutDate), new Date(booking.checkInDate))
    const newCheckOut = addDays(newCheckIn, nights)
    const startDay    = differenceInCalendarDays(newCheckIn, new Date(year, month, 1)) + 1

    const conflict = bookings.some(
      (b) =>
        b.id !== dragState.bookingId &&
        b.roomId === roomId &&
        !['CANCELLED', 'CHECKED_OUT'].includes(b.status) &&
        new Date(b.checkInDate) < newCheckOut &&
        new Date(b.checkOutDate) > newCheckIn
    )

    setGhostBar({ roomId, startDay, nights, isValid: !conflict })
  }

  function handleDrop(e: React.DragEvent, roomId: string, day: number) {
    e.preventDefault()
    if (!dragState || !ghostBar || !ghostBar.isValid) return

    const booking = bookings.find((b) => b.id === dragState.bookingId)
    if (!booking) return

    const newCheckIn  = new Date(year, month, day - dragState.offsetDays)
    const nights      = differenceInCalendarDays(new Date(booking.checkOutDate), new Date(booking.checkInDate))
    const newCheckOut = addDays(newCheckIn, nights)
    const previousBookings = bookings

    // Optimistic update
    const targetRoom = rooms.find((r) => r.id === roomId)
    const updated = bookings.map((b): BookingWithRelations => {
      if (b.id !== booking.id) return b
      return {
        ...b,
        checkInDate:  newCheckIn,
        checkOutDate: newCheckOut,
        roomId,
        room: targetRoom ? { ...b.room, id: roomId, name: targetRoom.name } : b.room,
      }
    })
    setBookings(updated)
    setDragState(null)
    setGhostBar(null)

    // API call with rollback on error
    ;(async () => {
      try {
        const res = await fetch(`/api/bookings/${booking.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkInDate:  newCheckIn.toISOString(),
            checkOutDate: newCheckOut.toISOString(),
            roomId,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error ?? 'Error al mover la reserva')
        }
        addToast('success', 'Reserva movida correctamente')
        await load()
      } catch (err) {
        setBookings(previousBookings)
        addToast('error', err instanceof Error ? err.message : 'Error al mover la reserva')
      }
    })()
  }

  function handleDragEnd() {
    setDragState(null)
    setGhostBar(null)
  }

  // --- Status change (from slide-over) ---
  async function handleStatusChange(id: string, status: string) {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Error al actualizar estado')
      setSelectedBooking(null)
      await load()
      addToast('success', 'Estado actualizado')
    } catch {
      addToast('error', 'Error al actualizar el estado')
    } finally {
      setUpdatingId(null)
    }
  }

  // --- Cell click (new booking) ---
  function handleCellClick(roomId: string, day: number) {
    const checkIn  = new Date(year, month, day).toISOString().split('T')[0]
    const checkOut = new Date(year, month, day + 1).toISOString().split('T')[0]
    setModalDefaults({ roomId, checkIn, checkOut })
    setModalOpen(true)
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <CalendarHeader
          currentDate={currentDate}
          onPrevMonth={() => setCurrentDate(new Date(year, month - 1, 1))}
          onNextMonth={() => setCurrentDate(new Date(year, month + 1, 1))}
          onToday={() => setCurrentDate(new Date())}
        />

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : (
          <CalendarGrid
            year={year}
            month={month}
            daysInMonth={daysInMonth}
            rooms={rooms}
            bookings={bookings}
            today={today}
            draggingBookingId={dragState?.bookingId ?? null}
            ghostBar={ghostBar}
            onCellClick={handleCellClick}
            onBookingClick={setSelectedBooking}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        )}
      </div>

      <BookingSlideOver
        booking={selectedBooking}
        onClose={handleSlideOverClose}
        onStatusChange={handleStatusChange}
        updatingId={updatingId}
      />

      <NewBookingModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); load() }}
        defaultRoomId={modalDefaults.roomId}
        defaultCheckIn={modalDefaults.checkIn}
        defaultCheckOut={modalDefaults.checkOut}
      />

      <Toast toasts={toasts} onRemove={removeToast} />
    </>
  )
}
