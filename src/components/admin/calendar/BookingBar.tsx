import { cn } from '@/lib/utils'
import type { BookingWithRelations } from '@/types'

const STATUS_BG: Record<string, string> = {
  PENDING:    'bg-amber-400 hover:bg-amber-500',
  CONFIRMED:  'bg-emerald-500 hover:bg-emerald-600',
  CHECKED_IN: 'bg-blue-500 hover:bg-blue-600',
  CHECKED_OUT:'bg-slate-400',
  CANCELLED:  'bg-red-400',
}

interface BookingBarProps {
  booking: BookingWithRelations
  checkInDay: number
  checkOutDay: number
  daysInMonth: number
  colWidth: number
  isAnyDragging: boolean
  isThisBeingDragged: boolean
  onClick: (booking: BookingWithRelations) => void
  onDragStart: (booking: BookingWithRelations, offsetDays: number) => void
}

export function BookingBar({
  booking,
  checkInDay,
  checkOutDay,
  daysInMonth,
  colWidth,
  isAnyDragging,
  isThisBeingDragged,
  onClick,
  onDragStart,
}: BookingBarProps) {
  // Clamp display range to current month
  const displayStart = Math.max(0, checkInDay - 1) // 0-indexed column
  const displayEnd   = Math.min(daysInMonth, checkOutDay - 1) // exclusive
  const displayNights = displayEnd - displayStart
  if (displayNights <= 0) return null

  const canDrag = !['CANCELLED', 'CHECKED_OUT'].includes(booking.status)
  const startsThisMonth = checkInDay >= 1
  const endsThisMonth   = checkOutDay <= daysInMonth + 1

  function handleDragStart(e: React.DragEvent) {
    if (!canDrag) { e.preventDefault(); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mouseRelX = Math.max(0, e.clientX - rect.left)
    const offsetFromBarStart = Math.floor(mouseRelX / colWidth)
    // Days of the booking clipped off on the left (started before this month)
    const clippedDays = Math.max(0, 1 - checkInDay)
    const offsetDays = clippedDays + offsetFromBarStart
    e.dataTransfer.effectAllowed = 'move'
    onDragStart(booking, offsetDays)
  }

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
        startsThisMonth && endsThisMonth  && 'rounded-full',
        startsThisMonth && !endsThisMonth && 'rounded-l-full',
        !startsThisMonth && endsThisMonth && 'rounded-r-full',
        isThisBeingDragged && 'opacity-40',
        isAnyDragging && !isThisBeingDragged && 'pointer-events-none',
      )}
    >
      <span className="truncate px-3 text-xs font-semibold text-white">
        {booking.guest.firstName}
      </span>
    </div>
  )
}
