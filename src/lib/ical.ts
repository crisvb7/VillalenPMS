/**
 * iCal sync library
 * Parses .ics feeds from Booking.com / Airbnb and imports reservations.
 * Also generates .ics export so OTAs can subscribe and block dates.
 */

interface ICalEvent {
  uid: string
  summary: string
  description?: string
  start: Date
  end: Date
  status: 'CONFIRMED' | 'CANCELLED' | 'TENTATIVE'
}

function parseIcalDate(value: string): Date {
  // Handle: 20240115, 20240115T140000Z, 20240115T140000
  const digits = value.replace(/\D/g, '').padEnd(14, '0')
  const y = parseInt(digits.slice(0, 4))
  const mo = parseInt(digits.slice(4, 6)) - 1
  const d = parseInt(digits.slice(6, 8))
  const h = parseInt(digits.slice(8, 10))
  const mi = parseInt(digits.slice(10, 12))
  const s = parseInt(digits.slice(12, 14))
  return value.includes('Z') ? new Date(Date.UTC(y, mo, d, h, mi, s)) : new Date(y, mo, d, h, mi, s)
}

export function parseIcal(text: string): ICalEvent[] {
  // Unfold continuation lines (lines starting with space/tab)
  const lines = text.replace(/\r\n|\r/g, '\n')
    .split('\n')
    .reduce<string[]>((acc, line) => {
      if ((line.startsWith(' ') || line.startsWith('\t')) && acc.length) {
        acc[acc.length - 1] += line.slice(1)
      } else {
        acc.push(line)
      }
      return acc
    }, [])

  const events: ICalEvent[] = []
  let inEvent = false
  let cur: Partial<ICalEvent> = {}

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; cur = {}; continue }
    if (line === 'END:VEVENT') {
      if (cur.uid && cur.start && cur.end) events.push(cur as ICalEvent)
      inEvent = false; continue
    }
    if (!inEvent) continue

    const colon = line.indexOf(':')
    if (colon === -1) continue
    const rawKey = line.substring(0, colon)
    const key = rawKey.split(';')[0].toUpperCase()
    const val = line.substring(colon + 1).trim()

    switch (key) {
      case 'UID':         cur.uid = val; break
      case 'SUMMARY':     cur.summary = val; break
      case 'DESCRIPTION': cur.description = val; break
      case 'DTSTART':     cur.start = parseIcalDate(val); break
      case 'DTEND':       cur.end = parseIcalDate(val); break
      case 'STATUS':
        cur.status = (['CONFIRMED', 'CANCELLED', 'TENTATIVE'].includes(val.toUpperCase())
          ? val.toUpperCase() : 'CONFIRMED') as ICalEvent['status']
        break
    }
  }
  return events
}

/** Extract guest name from iCal SUMMARY or DESCRIPTION */
function extractGuestName(event: ICalEvent): { firstName: string; lastName: string } {
  // Booking.com: "CLOSED - Not available" or "Reservation ID: 123456"
  // Airbnb: "Reserved", "Airbnb (not available)", or guest name
  const summary = event.summary ?? ''
  const desc = event.description ?? ''

  // Try to find a real name in description (Airbnb includes it sometimes)
  const nameMatch = desc.match(/(?:Name|Guest):\s*(.+?)(?:\n|$)/i)
  if (nameMatch) {
    const parts = nameMatch[1].trim().split(' ')
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') || '—' }
  }

  // Fallback: use summary if it looks like a name (not all caps/keywords)
  const blockedKeywords = ['closed', 'not available', 'reserved', 'airbnb', 'booking', 'blocked']
  const isBlocked = blockedKeywords.some((k) => summary.toLowerCase().includes(k))
  if (!isBlocked && summary.includes(' ')) {
    const parts = summary.split(' ')
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
  }

  return { firstName: 'Huésped', lastName: `iCal-${event.uid.slice(-6)}` }
}

const BLOCKED_SUMMARIES = ['closed', 'not available', 'not_available', 'blocked', 'unavailable']

function isBlockedEvent(event: ICalEvent): boolean {
  const summary = (event.summary ?? '').toLowerCase()
  const desc    = (event.description ?? '').toLowerCase()
  return BLOCKED_SUMMARIES.some((k) => summary.includes(k) || desc.includes(k))
}

export async function syncIcalFeed(
  feedId: string,
  roomId: string,
  platform: string,
  url: string
): Promise<{ created: number; cancelled: number; skipped: number; error?: string }> {
  const { prisma } = await import('./prisma')
  const stats = { created: 0, cancelled: 0, skipped: 0 }

  let text: string
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'HotelPMS/1.0' }, signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    text = await res.text()
  } catch (e) {
    const error = e instanceof Error ? e.message : 'fetch failed'
    await prisma.iCalFeed.update({ where: { id: feedId }, data: { lastError: error } })
    return { ...stats, error }
  }

  const events = parseIcal(text)

  for (const event of events) {
    const externalId = `ical-${platform}-${event.uid}`

    // Handle cancellations
    if (event.status === 'CANCELLED') {
      const existing = await prisma.booking.findUnique({ where: { externalId } })
      if (existing && existing.status !== 'CANCELLED') {
        await prisma.booking.update({ where: { id: existing.id }, data: { status: 'CANCELLED' } })
        stats.cancelled++
      }
      continue
    }

    // Handle blocked/closed events (e.g. Booking.com "CLOSED - Not available")
    if (isBlockedEvent(event)) {
      const existingBlock = await prisma.availabilityBlock.findUnique({ where: { externalId } })
      if (!existingBlock) {
        await prisma.availabilityBlock.create({
          data: {
            roomId,
            startDate: event.start,
            endDate:   event.end,
            platforms: [platform],
            reason:    event.summary ?? 'CLOSED',
            externalId,
            source:    'ical_sync',
          },
        })
        stats.created++
      } else {
        stats.skipped++
      }
      continue
    }

    // Skip if already imported as booking
    const exists = await prisma.booking.findUnique({ where: { externalId } })
    if (exists) { stats.skipped++; continue }

    // Skip past events (ended more than 1 day ago)
    if (event.end < new Date(Date.now() - 86400000)) { stats.skipped++; continue }

    // Check for overbooking conflict
    const conflict = await prisma.booking.findFirst({
      where: {
        roomId,
        status: { notIn: ['CANCELLED'] },
        AND: [{ checkInDate: { lt: event.end } }, { checkOutDate: { gt: event.start } }],
      },
    })
    if (conflict) {
      console.warn(`[iCal] Overbooking conflict for ${externalId}`)
      stats.skipped++
      continue
    }

    // Create a placeholder guest
    const { firstName, lastName } = extractGuestName(event)
    const documentId = `ICAL-${platform.toUpperCase()}-${event.uid.slice(-12)}`

    const guest = await prisma.guest.upsert({
      where: { documentId },
      update: {},
      create: {
        firstName, lastName, documentId,
        email: `${documentId.toLowerCase()}@ical.noreply`,
      },
    })

    const nights = Math.max(1, Math.ceil((event.end.getTime() - event.start.getTime()) / 86400000))
    const room = await prisma.room.findUnique({ where: { id: roomId } })
    const totalAmount = room ? Number(room.basePrice) * nights : 0

    const sourceMap: Record<string, 'BOOKING' | 'AIRBNB' | 'MANUAL'> = {
      booking_com: 'BOOKING', airbnb: 'AIRBNB',
    }

    await prisma.booking.create({
      data: {
        guestId: guest.id, roomId,
        checkInDate: event.start, checkOutDate: event.end,
        totalAmount, status: 'CONFIRMED',
        source: sourceMap[platform] ?? 'MANUAL',
        externalId,
        notes: `iCal sync · ${platform} · ${event.uid}`,
      },
    })
    stats.created++
  }

  await prisma.iCalFeed.update({
    where: { id: feedId },
    data: { lastSync: new Date(), lastError: null },
  })

  return stats
}

/** Generate iCal export of our bookings + manual blocks for a room */
export function generateIcalExport(
  bookings: Array<{ externalId: string | null; checkInDate: Date; checkOutDate: Date; guest: { firstName: string; lastName: string } }>,
  blocks: Array<{ id: string; startDate: Date; endDate: Date }>,
  roomName: string
): string {
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'

  const bookingEvents = bookings
    .filter((b) => b.checkOutDate > new Date())
    .map((b) => {
      const uid = b.externalId ?? `pms-${b.checkInDate.getTime()}`
      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        `DTSTART:${fmt(b.checkInDate)}`,
        `DTEND:${fmt(b.checkOutDate)}`,
        `SUMMARY:BLOCKED - ${b.guest.firstName} ${b.guest.lastName}`,
        `STATUS:CONFIRMED`,
        'END:VEVENT',
      ].join('\r\n')
    })

  const blockEvents = blocks
    .filter((bl) => bl.endDate > new Date())
    .map((bl) => [
      'BEGIN:VEVENT',
      `UID:block-${bl.id}`,
      `DTSTAMP:${now}`,
      `DTSTART:${fmt(bl.startDate)}`,
      `DTEND:${fmt(bl.endDate)}`,
      `SUMMARY:CLOSED - Not available`,
      `STATUS:CONFIRMED`,
      'END:VEVENT',
    ].join('\r\n'))

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hotel PMS//Casa La Aldea//ES',
    `X-WR-CALNAME:${roomName}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...bookingEvents,
    ...blockEvents,
    'END:VCALENDAR',
  ].join('\r\n')
}
