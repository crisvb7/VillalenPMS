'use client'

import { useState, useEffect, useCallback } from 'react'
import { getDaysInMonth, differenceInCalendarDays, addDays } from 'date-fns'
import { CalendarHeader } from './calendar/CalendarHeader'
import { CalendarGrid } from './calendar/CalendarGrid'
import { BookingSlideOver } from './calendar/BookingSlideOver'
import { Toast, type ToastData } from '@/components/ui/Toast'
import { NewBookingModal } from './NewBookingModal'
import { BlockDatesModal } from './BlockDatesModal'
import type { BookingWithRelations, AvailabilityBlock } from '@/types'
import type { GhostBar } from './calendar/RoomRow'

interface Room { id: string; name: string }

interface DragState {
  bookingId: string
  offsetDays: number
}

interface CellMenu {
  roomId: string
  colOffset: number
  x: number
  y: number
}

export function HotelCalendar() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [rooms, setRooms] = useState<Room[]>([])
  const [bookings, setBookings] = useState<BookingWithRelations[]>([])
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBooking, setSelectedBooking] = useState<BookingWithRelations | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [ghostBar, setGhostBar] = useState<GhostBar | null>(null)
  const [toasts, setToasts] = useState<ToastData[]>([])
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDefaults, setModalDefaults] = useState<{ roomId?: string; checkIn?: string; checkOut?: string }>({})
  const [cellMenu, setCellMenu] = useState<CellMenu | null>(null)
  const [blockMenu, setBlockMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [blockModalOpen, setBlockModalOpen] = useState(false)
  const [blockDatesDefaults, setBlockDatesDefaults] = useState({ start: '', end: '' })

  const windowSize = getDaysInMonth(startDate)
  const today = new Date()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const from = startDate.toISOString()
      const to   = addDays(startDate, windowSize).toISOString()
      const [r, b, bl] = await Promise.all([
        fetch('/api/rooms').then((res) => res.json()),
        fetch(`/api/bookings?from=${from}&to=${to}`).then((res) => res.json()),
        fetch(`/api/availability-blocks?from=${from}&to=${to}`).then((res) => res.json()),
      ])
      setRooms(r)
      setBookings(b)
      setBlocks(bl)
    } finally {
      setLoading(false)
    }
  }, [startDate, windowSize])

  useEffect(() => { load() }, [load])

  // Close cell/block menus on outside click
  useEffect(() => {
    if (!cellMenu && !blockMenu) return
    function handler() { setCellMenu(null); setBlockMenu(null) }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [cellMenu, blockMenu])

  function addToast(type: 'success' | 'error', message: string) {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, type, message }])
  }
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const handleSlideOverClose = useCallback(() => setSelectedBooking(null), [])

  function handleDragStart(booking: BookingWithRelations, offsetDays: number) {
    setDragState({ bookingId: booking.id, offsetDays })
  }

  function handleDragOver(e: React.DragEvent, roomId: string, colOffset: number) {
    if (!dragState) return
    const booking = bookings.find((b) => b.id === dragState.bookingId)
    if (!booking) return

    const newCheckIn  = addDays(startDate, colOffset - dragState.offsetDays)
    const nights      = differenceInCalendarDays(new Date(booking.checkOutDate), new Date(booking.checkInDate))
    const newCheckOut = addDays(newCheckIn, nights)
    const startCol    = differenceInCalendarDays(newCheckIn, startDate)

    const conflict = bookings.some(
      (b) =>
        b.id !== dragState.bookingId &&
        b.roomId === roomId &&
        !['CANCELLED', 'CHECKED_OUT'].includes(b.status) &&
        new Date(b.checkInDate) < newCheckOut &&
        new Date(b.checkOutDate) > newCheckIn
    )

    setGhostBar({ roomId, startCol, nights, isValid: !conflict })
  }

  function handleDrop(e: React.DragEvent, roomId: string, colOffset: number) {
    e.preventDefault()
    if (!dragState || !ghostBar || !ghostBar.isValid) return

    const booking = bookings.find((b) => b.id === dragState.bookingId)
    if (!booking) return

    const newCheckIn  = addDays(startDate, colOffset - dragState.offsetDays)
    const nights      = differenceInCalendarDays(new Date(booking.checkOutDate), new Date(booking.checkInDate))
    const newCheckOut = addDays(newCheckIn, nights)
    const previousBookings = bookings

    const targetRoom = rooms.find((r) => r.id === roomId)
    const updated = bookings.map((b): BookingWithRelations => {
      if (b.id !== booking.id) return b
      return {
        ...b,
        checkInDate:  newCheckIn.toISOString() as unknown as Date,
        checkOutDate: newCheckOut.toISOString() as unknown as Date,
        roomId,
        room: targetRoom ? { ...b.room, id: roomId, name: targetRoom.name } : b.room,
      }
    })
    setBookings(updated)
    setDragState(null)
    setGhostBar(null)

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

  function handleCellClick(roomId: string, colOffset: number, clientX: number, clientY: number) {
    setCellMenu({ roomId, colOffset, x: clientX, y: clientY })
  }

  async function deleteBlock(id: string) {
    setBlockMenu(null)
    try {
      const res = await fetch(`/api/availability-blocks/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      await load()
      addToast('success', 'Bloqueo eliminado')
    } catch {
      addToast('error', 'Error al eliminar el bloqueo')
    }
  }

  function openNewBooking() {
    if (!cellMenu) return
    const checkIn  = addDays(startDate, cellMenu.colOffset).toISOString().split('T')[0]
    const checkOut = addDays(startDate, cellMenu.colOffset + 1).toISOString().split('T')[0]
    setModalDefaults({ roomId: cellMenu.roomId, checkIn, checkOut })
    setModalOpen(true)
    setCellMenu(null)
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <CalendarHeader
          startDate={startDate}
          onPrevDay={() => setStartDate((d) => addDays(d, -1))}
          onNextDay={() => setStartDate((d) => addDays(d, 1))}
          onToday={() => {
            const d = new Date()
            d.setHours(0, 0, 0, 0)
            setStartDate(d)
          }}
          onMonthYearChange={(year, month) => setStartDate(new Date(year, month, 1))}
        />

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : (
          <CalendarGrid
            startDate={startDate}
            windowSize={windowSize}
            rooms={rooms}
            bookings={bookings}
            blocks={blocks}
            today={today}
            draggingBookingId={dragState?.bookingId ?? null}
            ghostBar={ghostBar}
            onCellClick={handleCellClick}
            onBookingClick={setSelectedBooking}
            onBlockDelete={(id, x, y) => setBlockMenu({ id, x, y })}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        )}
      </div>

      {/* Cell action menu */}
      {cellMenu && (
        <div
          className="fixed z-50 rounded-xl border border-slate-200 bg-white shadow-xl py-1 min-w-[160px]"
          style={{ top: cellMenu.y + 8, left: cellMenu.x - 80 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={openNewBooking}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Nueva reserva
          </button>
          <button
            onClick={() => {
              if (!cellMenu) return
              setModalDefaults({ roomId: cellMenu.roomId })
              const dateStr = addDays(startDate, cellMenu.colOffset).toISOString().split('T')[0]
              setBlockDatesDefaults({ start: dateStr, end: dateStr })
              setBlockModalOpen(true)
              setCellMenu(null)
            }}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Bloquear fechas
          </button>
        </div>
      )}

      {/* Block action menu */}
      {blockMenu && (
        <div
          className="fixed z-50 rounded-xl border border-slate-200 bg-white shadow-xl py-1 min-w-[160px]"
          style={{ top: blockMenu.y + 8, left: blockMenu.x - 80 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => deleteBlock(blockMenu.id)}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            Eliminar bloqueo
          </button>
        </div>
      )}

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

      <BlockDatesModal
        open={blockModalOpen}
        roomId={modalDefaults.roomId ?? null}
        defaultStart={blockDatesDefaults.start}
        defaultEnd={blockDatesDefaults.end}
        onClose={() => setBlockModalOpen(false)}
        onCreated={() => { load(); addToast('success', 'Fechas bloqueadas') }}
      />

      <Toast toasts={toasts} onRemove={removeToast} />
    </>
  )
}
