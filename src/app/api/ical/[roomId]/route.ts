import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateIcalExport } from '@/lib/ical'

export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const platform = req.nextUrl.searchParams.get('platform') ?? undefined

  const [bookings, room, blocks] = await Promise.all([
    prisma.booking.findMany({
      where: {
        roomId,
        status: { notIn: ['CANCELLED'] },
        checkOutDate: { gte: new Date() },
      },
      include: { guest: true },
      orderBy: { checkInDate: 'asc' },
    }),
    prisma.room.findUnique({ where: { id: roomId } }),
    prisma.availabilityBlock.findMany({
      where: {
        roomId,
        endDate: { gte: new Date() },
        ...(platform && {
          platforms: { has: platform },
        }),
      },
    }),
  ])

  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  const ical = generateIcalExport(bookings, blocks, room.name)

  return new NextResponse(ical, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${room.name.replace(/\s+/g, '_')}.ics"`,
      'Cache-Control': 'no-cache',
    },
  })
}
