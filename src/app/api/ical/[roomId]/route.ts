import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateIcalExport } from '@/lib/ical'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params

  const bookings = await prisma.booking.findMany({
    where: {
      roomId,
      status: { notIn: ['CANCELLED'] },
      checkOutDate: { gte: new Date() },
    },
    include: { guest: true },
    orderBy: { checkInDate: 'asc' },
  })

  const room = await prisma.room.findUnique({ where: { id: roomId } })
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  const ical = generateIcalExport(bookings, room.name)

  return new NextResponse(ical, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${room.name.replace(/\s+/g, '_')}.ics"`,
      'Cache-Control': 'no-cache',
    },
  })
}
