'use client'

import { useRef } from 'react'
import { isSameDay, addDays, differenceInCalendarDays } from 'date-fns'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BookingBar } from './BookingBar'
import { BlockBar } from './BlockBar'
import type { BookingWithRelations, AvailabilityBlock } from '@/types'

export interface GhostBar {
  roomId: string
  startCol: number  // 0-indexed offset from startDate
  nights: number
  isValid: boolean
}

interface RoomRowProps {
  room: { id: string; name: string }
  bookings: BookingWithRelations[]
  blocks: AvailabilityBlock[]
  startDate: Date
  windowSize: number
  colWidth: number
  roomLabelWidth: number
  today: Date
  draggingBookingId: string | null
  ghostBar: GhostBar | null
  onCellClick: (roomId: string, colOffset: number, clientX: number, clientY: number) => void
  onBookingClick: (booking: BookingWithRelations) => void
  onDragStart: (booking: BookingWithRelations, offsetDays: number) => void
  onDragOver: (e: React.DragEvent, roomId: string, colOffset: number) => void
  onDrop: (e: React.DragEvent, roomId: string, colOffset: number) => void
}

export function RoomRow({
  room, bookings, blocks, startDate, windowSize, colWidth, roomLabelWidth,
  today, draggingBookingId, ghostBar,
  onCellClick, onBookingClick, onDragStart, onDragOver, onDrop,
}: RoomRowProps) {
  const dayAreaRef = useRef<HTMLDivElement>(null)
  const offsets = Array.from({ length: windowSize }, (_, i) => i)
  const isAnyDragging = draggingBookingId !== null

  function getColOffsetFromEvent(e: React.DragEvent): number {
    if (!dayAreaRef.current) return 0
    const rect = dayAreaRef.current.getBoundingClientRect()
    const relX = e.clientX - rect.left
    return Math.max(0, Math.min(windowSize - 1, Math.floor(relX / colWidth)))
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    onDragOver(e, room.id, getColOffsetFromEvent(e))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    onDrop(e, room.id, getColOffsetFromEvent(e))
  }

  const myGhostBar = ghostBar?.roomId === room.id ? ghostBar : null

  return (
    <div className="flex" style={{ height: 70 }}>
      {/* Room label */}
      <div
        className="sticky left-0 z-10 flex flex-none items-center border-r border-slate-100 bg-white px-4"
        style={{ width: roomLabelWidth, minWidth: roomLabelWidth }}
      >
        <span className="text-sm font-semibold text-slate-700 truncate">{room.name}</span>
      </div>

      {/* Day area */}
      <div
        ref={dayAreaRef}
        className="relative"
        style={{ width: windowSize * colWidth, minWidth: windowSize * colWidth }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Background cells */}
        {offsets.map((colOffset) => {
          const date = addDays(startDate, colOffset)
          const isToday = isSameDay(date, today)
          const dayOfWeek = (date.getDay() + 6) % 7
          const isWeekend = dayOfWeek >= 5
          const hasBooking = bookings.some((b) => {
            const checkIn = differenceInCalendarDays(new Date(b.checkInDate), startDate)
            const checkOut = differenceInCalendarDays(new Date(b.checkOutDate), startDate)
            return (
              !['CANCELLED', 'CHECKED_OUT'].includes(b.status) &&
              colOffset >= checkIn &&
              colOffset < checkOut
            )
          })
          return (
            <div
              key={colOffset}
              style={{ position: 'absolute', left: colOffset * colWidth, width: colWidth, top: 0, bottom: 0 }}
              className={cn(
                'border-r border-slate-100 group',
                isToday && !hasBooking && 'bg-indigo-50/50',
                isWeekend && !isToday && 'bg-slate-50/60',
                !hasBooking && !isAnyDragging && 'hover:bg-indigo-50 cursor-pointer',
              )}
              onClick={(e) => !hasBooking && !isAnyDragging && onCellClick(room.id, colOffset, e.clientX, e.clientY)}
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
        {bookings.map((booking) => {
          const checkInOffset  = differenceInCalendarDays(new Date(booking.checkInDate), startDate)
          const checkOutOffset = differenceInCalendarDays(new Date(booking.checkOutDate), startDate)
          return (
            <BookingBar
              key={booking.id}
              booking={booking}
              checkInOffset={checkInOffset}
              checkOutOffset={checkOutOffset}
              windowSize={windowSize}
              colWidth={colWidth}
              isAnyDragging={isAnyDragging}
              isThisBeingDragged={booking.id === draggingBookingId}
              onClick={onBookingClick}
              onDragStart={onDragStart}
            />
          )
        })}

        {/* Availability block bars */}
        {blocks.map((block, idx) => {
          const startOffset = differenceInCalendarDays(new Date(block.startDate), startDate)
          const endOffset   = differenceInCalendarDays(new Date(block.endDate),   startDate)
          return (
            <BlockBar
              key={block.id}
              block={block}
              startOffset={startOffset}
              endOffset={endOffset}
              windowSize={windowSize}
              colWidth={colWidth}
              stackIndex={idx % 3}
            />
          )
        })}

        {/* Ghost bar */}
        {myGhostBar && (
          <div
            className={cn(
              'pointer-events-none absolute rounded-full border-2 border-dashed',
              myGhostBar.isValid
                ? 'bg-indigo-200/50 border-indigo-400'
                : 'bg-red-200/50 border-red-400'
            )}
            style={{
              left:   Math.max(0, myGhostBar.startCol) * colWidth + 2,
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
