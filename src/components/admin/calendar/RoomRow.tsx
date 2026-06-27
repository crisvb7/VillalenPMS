'use client'

import { useRef } from 'react'
import { isSameDay, isWithinInterval, addDays, differenceInCalendarDays } from 'date-fns'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BookingBar } from './BookingBar'
import type { BookingWithRelations } from '@/types'

export interface GhostBar {
  roomId: string
  startDay: number   // 1-indexed
  nights: number
  isValid: boolean
}

// Day number (1-indexed) in the given month for a date; can be ≤ 0 or > daysInMonth
function toDayInMonth(date: Date | string, year: number, month: number): number {
  return differenceInCalendarDays(new Date(date), new Date(year, month, 1)) + 1
}

interface RoomRowProps {
  room: { id: string; name: string }
  bookings: BookingWithRelations[]
  year: number
  month: number
  daysInMonth: number
  colWidth: number
  roomLabelWidth: number
  today: Date
  draggingBookingId: string | null
  ghostBar: GhostBar | null
  onCellClick: (roomId: string, day: number) => void
  onBookingClick: (booking: BookingWithRelations) => void
  onDragStart: (booking: BookingWithRelations, offsetDays: number) => void
  onDragOver: (e: React.DragEvent, roomId: string, day: number) => void
  onDrop: (e: React.DragEvent, roomId: string, day: number) => void
}

export function RoomRow({
  room, bookings, year, month, daysInMonth, colWidth, roomLabelWidth,
  today, draggingBookingId, ghostBar,
  onCellClick, onBookingClick, onDragStart, onDragOver, onDrop,
}: RoomRowProps) {
  const dayAreaRef = useRef<HTMLDivElement>(null)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const isAnyDragging = draggingBookingId !== null

  function getDayFromEvent(e: React.DragEvent): number {
    if (!dayAreaRef.current) return 1
    const rect = dayAreaRef.current.getBoundingClientRect()
    const relX = e.clientX - rect.left
    return Math.max(1, Math.min(daysInMonth, Math.floor(relX / colWidth) + 1))
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    onDragOver(e, room.id, getDayFromEvent(e))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    onDrop(e, room.id, getDayFromEvent(e))
  }

  const myGhostBar = ghostBar?.roomId === room.id ? ghostBar : null

  return (
    <div className="flex" style={{ height: 52 }}>
      {/* Room label — sticky left */}
      <div
        className="sticky left-0 z-10 flex flex-none items-center border-r border-slate-100 bg-white px-4"
        style={{ width: roomLabelWidth, minWidth: roomLabelWidth }}
      >
        <span className="text-sm font-semibold text-slate-700 truncate">{room.name}</span>
      </div>

      {/* Day area — drop zone + bars */}
      <div
        ref={dayAreaRef}
        className="relative"
        style={{ width: daysInMonth * colWidth, minWidth: daysInMonth * colWidth }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Background cells */}
        {days.map((day) => {
          const date = new Date(year, month, day)
          const isToday = isSameDay(date, today)
          const dayOfWeek = (date.getDay() + 6) % 7
          const isWeekend = dayOfWeek >= 5
          const hasBooking = bookings.some(
            (b) =>
              !['CANCELLED', 'CHECKED_OUT'].includes(b.status) &&
              isWithinInterval(date, {
                start: new Date(b.checkInDate),
                end: addDays(new Date(b.checkOutDate), -1),
              })
          )
          return (
            <div
              key={day}
              style={{ position: 'absolute', left: (day - 1) * colWidth, width: colWidth, top: 0, bottom: 0 }}
              className={cn(
                'border-r border-slate-100 group',
                isToday && !hasBooking && 'bg-indigo-50/50',
                isWeekend && !isToday && 'bg-slate-50/60',
                !hasBooking && !isAnyDragging && 'hover:bg-indigo-50 cursor-pointer',
              )}
              onClick={() => !hasBooking && !isAnyDragging && onCellClick(room.id, day)}
            >
              {!hasBooking && !isAnyDragging && (
                <div className="flex h-full items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <Plus className="h-3 w-3 text-indigo-400" />
                </div>
              )}
            </div>
          )
        })}

        {/* Booking bars */}
        {bookings.map((booking) => (
          <BookingBar
            key={booking.id}
            booking={booking}
            checkInDay={toDayInMonth(booking.checkInDate, year, month)}
            checkOutDay={toDayInMonth(booking.checkOutDate, year, month)}
            daysInMonth={daysInMonth}
            colWidth={colWidth}
            isAnyDragging={isAnyDragging}
            isThisBeingDragged={booking.id === draggingBookingId}
            onClick={onBookingClick}
            onDragStart={onDragStart}
          />
        ))}

        {/* Ghost bar preview during drag */}
        {myGhostBar && (
          <div
            className={cn(
              'pointer-events-none absolute rounded-full border-2 border-dashed',
              myGhostBar.isValid
                ? 'bg-indigo-200/50 border-indigo-400'
                : 'bg-red-200/50 border-red-400'
            )}
            style={{
              left:   Math.max(0, myGhostBar.startDay - 1) * colWidth + 2,
              width:  myGhostBar.nights * colWidth - 4,
              top: 6,
              height: 40,
            }}
          />
        )}
      </div>
    </div>
  )
}
