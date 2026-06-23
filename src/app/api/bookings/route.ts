import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pushAvailability } from '@/lib/channex'
import type { BookingSource } from '@/db/client'

async function checkOverbooking(
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  excludeId?: string
): Promise<boolean> {
  const conflict = await prisma.booking.findFirst({
    where: {
      roomId,
      ...(excludeId && { id: { not: excludeId } }),
      status: { notIn: ['CANCELLED'] },
      AND: [{ checkInDate: { lt: checkOut } }, { checkOutDate: { gt: checkIn } }],
    },
  })
  return !!conflict
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const roomId = searchParams.get('roomId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const bookings = await prisma.booking.findMany({
      where: {
        ...(status && { status: status as never }),
        ...(roomId && { roomId }),
        ...(from && to && {
          OR: [
            { checkInDate: { gte: new Date(from), lte: new Date(to) } },
            { checkOutDate: { gte: new Date(from), lte: new Date(to) } },
            { checkInDate: { lte: new Date(from) }, checkOutDate: { gte: new Date(to) } },
          ],
        }),
      },
      include: { guest: true, room: true, invoice: true },
      orderBy: { checkInDate: 'asc' },
    })
    return NextResponse.json(bookings)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener reservas' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      roomId, checkInDate, checkOutDate,
      source = 'WEB', notes,
      guestId, firstName, lastName, documentId, email, phone,
    } = body

    if (!roomId || !checkInDate || !checkOutDate) {
      return NextResponse.json({ error: 'Faltan campos requeridos: roomId, checkInDate, checkOutDate' }, { status: 400 })
    }

    const checkIn = new Date(checkInDate)
    const checkOut = new Date(checkOutDate)
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()))
      return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 })
    if (checkIn >= checkOut)
      return NextResponse.json({ error: 'La fecha de salida debe ser posterior a la de entrada' }, { status: 400 })

    const room = await prisma.room.findUnique({ where: { id: roomId } })
    if (!room) return NextResponse.json({ error: 'Habitación no encontrada' }, { status: 404 })

    if (await checkOverbooking(roomId, checkIn, checkOut))
      return NextResponse.json({ error: 'Overbooking: la habitación no está disponible.' }, { status: 409 })

    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86400000)
    const totalAmount = Number(room.basePrice) * nights

    let resolvedGuestId = guestId
    if (!resolvedGuestId) {
      if (!firstName || !lastName || !documentId || !email)
        return NextResponse.json({ error: 'Se requieren datos del huésped' }, { status: 400 })

      const existing = await prisma.guest.findUnique({ where: { documentId } })
      if (existing) {
        resolvedGuestId = existing.id
        await prisma.guest.update({ where: { id: existing.id }, data: { firstName, lastName, email, ...(phone && { phone }) } })
      } else {
        const g = await prisma.guest.create({ data: { firstName, lastName, documentId, email, phone: phone || null } })
        resolvedGuestId = g.id
      }
    }

    const booking = await prisma.booking.create({
      data: {
        guestId: resolvedGuestId, roomId,
        checkInDate: checkIn, checkOutDate: checkOut,
        totalAmount, source: source as BookingSource, notes: notes || null,
      },
      include: { guest: true, room: true },
    })

    // Push availability to channel manager (fire-and-forget)
    if (room.channexRoomTypeId) {
      pushAvailability(room.channexRoomTypeId, checkIn, checkOut, 0).catch((e) =>
        console.error('[Channex] availability push failed:', e)
      )
    }

    return NextResponse.json(booking, { status: 201 })
  } catch (error) {
    console.error('[POST /api/bookings]', error)
    return NextResponse.json({ error: 'Error al crear reserva' }, { status: 500 })
  }
}
