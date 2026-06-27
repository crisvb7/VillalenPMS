import { cn } from '@/lib/utils'
import type { BookingWithRelations } from '@/types'

const STATUS_BG: Record<string, string> = {
  PENDING:    'bg-amber-400 hover:bg-amber-500',
  CONFIRMED:  'bg-emerald-500 hover:bg-emerald-600',
  CHECKED_IN: 'bg-blue-500 hover:bg-blue-600',
  CHECKED_OUT:'bg-slate-400',
  CANCELLED:  'bg-red-400',
}

const SOURCE_BADGE: Record<string, string> = {
  BOOKING: 'B',
  AIRBNB:  'A',
  WEB:     'W',
  MANUAL:  'M',
}

interface BookingBarProps {
  booking: BookingWithRelations
  checkInOffset: number   // 0-indexed from startDate, can be negative
  checkOutOffset: number  // exclusive, can exceed windowSize
  windowSize: number
  colWidth: number
  isAnyDragging: boolean
  isThisBeingDragged: boolean
  onClick: (booking: BookingWithRelations) => void
  onDragStart: (booking: BookingWithRelations, offsetDays: number) => void
}

export function BookingBar({
  booking, checkInOffset, checkOutOffset, windowSize, colWidth,
  isAnyDragging, isThisBeingDragged, onClick, onDragStart,
}: BookingBarProps) {
  const displayStart = Math.max(0, checkInOffset)
  const displayEnd   = Math.min(windowSize, checkOutOffset)
  const displayNights = displayEnd - displayStart
  if (displayNights <= 0) return null

  const canDrag = !['CANCELLED', 'CHECKED_OUT'].includes(booking.status)
  const startsInWindow = checkInOffset >= 0
  const endsInWindow   = checkOutOffset <= windowSize

  function handleDragStart(e: React.DragEvent) {
    if (!canDrag) { e.preventDefault(); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mouseRelX = Math.max(0, e.clientX - rect.left)
    const offsetFromBarStart = Math.floor(mouseRelX / colWidth)
    const clippedDays = Math.max(0, -checkInOffset)
    const offsetDays = clippedDays + offsetFromBarStart
    e.dataTransfer.effectAllowed = 'move'
    onDragStart(booking, offsetDays)
  }

  const badge = SOURCE_BADGE[booking.source] ?? 'M'

  return (
    <div
      draggable={canDrag}
      onDragStart={handleDragStart}
      onClick={() => onClick(booking)}
      style={{
        position: 'absolute',
        left:   displayStart * colWidth + 2,
        width:  displayNights * colWidth - 4,
        top:    6,
        height: 40,
      }}
      className={cn(
        'flex items-center overflow-hidden transition-opacity select-none',
        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        STATUS_BG[booking.status] ?? 'bg-slate-400',
        startsInWindow && endsInWindow  && 'rounded-full',
        startsInWindow && !endsInWindow && 'rounded-l-full',
        !startsInWindow && endsInWindow && 'rounded-r-full',
        isThisBeingDragged && 'opacity-40',
        isAnyDragging && !isThisBeingDragged && 'pointer-events-none',
      )}
    >
      <span className="flex-1 truncate px-3 text-xs font-semibold text-white">
        {booking.guest.firstName}
      </span>
      <span className="mr-2 flex-shrink-0 rounded bg-black/20 px-1 text-[9px] font-bold text-white/90">
        {badge}
      </span>
    </div>
  )
}
