import { useRef, useState, useEffect } from 'react'
import { DayHeaders } from './DayHeaders'
import { RoomRow, type GhostBar } from './RoomRow'
import type { BookingWithRelations, AvailabilityBlock } from '@/types'

export const ROOM_LABEL_WIDTH = 160
const MIN_COL_WIDTH = 32

interface CalendarGridProps {
  startDate: Date
  windowSize: number
  rooms: { id: string; name: string }[]
  bookings: BookingWithRelations[]
  blocks: AvailabilityBlock[]
  today: Date
  draggingBookingId: string | null
  ghostBar: GhostBar | null
  onCellClick: (roomId: string, colOffset: number, clientX: number, clientY: number) => void
  onBookingClick: (booking: BookingWithRelations) => void
  onBlockDelete: (id: string, x: number, y: number) => void
  onDragStart: (booking: BookingWithRelations, offsetDays: number) => void
  onDragOver: (e: React.DragEvent, roomId: string, colOffset: number) => void
  onDrop: (e: React.DragEvent, roomId: string, colOffset: number) => void
  onDragEnd: () => void
}

export function CalendarGrid({
  startDate, windowSize, rooms, bookings, blocks, today,
  draggingBookingId, ghostBar,
  onCellClick, onBookingClick, onBlockDelete, onDragStart, onDragOver, onDrop, onDragEnd,
}: CalendarGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [colWidth, setColWidth] = useState(MIN_COL_WIDTH)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      const available = entry.contentRect.width - ROOM_LABEL_WIDTH
      setColWidth(Math.max(MIN_COL_WIDTH, available / windowSize))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [windowSize])

  const totalWidth = ROOM_LABEL_WIDTH + windowSize * colWidth

  return (
    <div ref={containerRef} className="overflow-x-auto" onDragEnd={onDragEnd}>
      <div style={{ minWidth: totalWidth }}>
        <div className="sticky top-0 z-20 flex border-b border-slate-100 bg-white">
          <div
            className="sticky left-0 z-30 flex flex-none items-end bg-slate-50 border-r border-slate-100 px-4 pb-2"
            style={{ width: ROOM_LABEL_WIDTH, minWidth: ROOM_LABEL_WIDTH }}
          >
            <span className="text-xs font-semibold text-slate-500">Habitación</span>
          </div>
          <DayHeaders
            startDate={startDate}
            windowSize={windowSize}
            today={today}
            colWidth={colWidth}
          />
        </div>
        <div className="divide-y divide-slate-100">
          {rooms.map((room) => (
            <RoomRow
              key={room.id}
              room={room}
              bookings={bookings.filter((b) => b.roomId === room.id)}
              blocks={blocks.filter((bl) => bl.roomId === room.id)}
              startDate={startDate}
              windowSize={windowSize}
              colWidth={colWidth}
              roomLabelWidth={ROOM_LABEL_WIDTH}
              today={today}
              draggingBookingId={draggingBookingId}
              ghostBar={ghostBar}
              onCellClick={onCellClick}
              onBookingClick={onBookingClick}
              onBlockDelete={onBlockDelete}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
