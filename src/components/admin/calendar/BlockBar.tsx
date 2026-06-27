import type { AvailabilityBlock } from '@/types'

const PLATFORM_STYLE: Record<string, { bg: string; label: string }> = {
  booking_com: { bg: '#003580', label: 'Booking.com' },
  airbnb:      { bg: '#FF5A5F', label: 'Airbnb'      },
  web:         { bg: '#9FE870', label: 'Web'          },
}

function getPlatformStyle(platform: string) {
  return PLATFORM_STYLE[platform] ?? { bg: '#94A3B8', label: platform }
}

interface BlockBarProps {
  block: AvailabilityBlock
  startOffset: number   // 0-indexed from startDate (can be negative)
  endOffset: number     // exclusive (can exceed windowSize)
  windowSize: number
  colWidth: number
  stackIndex: number    // 0 = bottom-most, stacks upward
}

export function BlockBar({ block, startOffset, endOffset, windowSize, colWidth, stackIndex }: BlockBarProps) {
  const displayStart  = Math.max(0, startOffset)
  const displayEnd    = Math.min(windowSize, endOffset)
  const displayNights = displayEnd - displayStart
  if (displayNights <= 0) return null

  const BAR_HEIGHT = 6
  const BAR_GAP    = 2
  // Anchor to bottom of row (row height 70px; booking bar ends at y=46 so 3 bars fit without overlap)
  const bottomBase = 70
  const bottom = BAR_GAP + stackIndex * (BAR_HEIGHT + BAR_GAP)
  const top    = bottomBase - bottom - BAR_HEIGHT

  const platforms = block.platforms.length > 0 ? block.platforms : ['manual']
  const style = getPlatformStyle(platforms[0])
  const tooltip = `${platforms.map((p) => getPlatformStyle(p).label).join(', ')}${block.reason ? ` · ${block.reason}` : ''}`

  return (
    <div
      title={tooltip}
      style={{
        position: 'absolute',
        left:     displayStart * colWidth + 1,
        width:    displayNights * colWidth - 2,
        top,
        height:   BAR_HEIGHT,
        background: `repeating-linear-gradient(45deg, ${style.bg}, ${style.bg} 3px, ${style.bg}cc 3px, ${style.bg}cc 6px)`,
        borderRadius: 2,
        opacity: 0.85,
      }}
    />
  )
}
