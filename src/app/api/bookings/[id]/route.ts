import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pushAvailability } from '@/lib/channex'
import type { BookingStatus } from '@/db/client'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { guest: true, room: true, invoice: true },
    })
    if (!booking) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    return NextResponse.json(booking)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener reserva' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()
    const { status, depositPaid, notes, checkInDate, checkOutDate } = body

    const before = await prisma.booking.findUnique({ where: { id }, include: { room: true } })
    if (!before) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        ...(status !== undefined && { status: status as BookingStatus }),
        ...(depositPaid !== undefined && { depositPaid: Boolean(depositPaid) }),
        ...(notes !== undefined && { notes }),
        ...(checkInDate !== undefined && { checkInDate: new Date(checkInDate) }),
        ...(checkOutDate !== undefined && { checkOutDate: new Date(checkOutDate) }),
      },
      include: { guest: true, room: true },
    })

    const roomTypeId = before.room.channexRoomTypeId
    if (roomTypeId) {
      const wasCancelled = before.status === 'CANCELLED'
      const isCancelled = status === 'CANCELLED'

      if (!wasCancelled && isCancelled) {
        // Booking cancelled → open dates
        pushAvailability(roomTypeId, before.checkInDate, before.checkOutDate, 1).catch(console.error)
      } else if (checkInDate || checkOutDate) {
        // Dates changed → open old range, block new range
        const newIn = checkInDate ? new Date(checkInDate) : before.checkInDate
        const newOut = checkOutDate ? new Date(checkOutDate) : before.checkOutDate
        pushAvailability(roomTypeId, before.checkInDate, before.checkOutDate, 1).catch(console.error)
        pushAvailability(roomTypeId, newIn, newOut, 0).catch(console.error)
      }
    }

    return NextResponse.json(booking)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar reserva' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const before = await prisma.booking.findUnique({ where: { id }, include: { room: true } })

    await prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' } })

    if (before?.room.channexRoomTypeId && before.status !== 'CANCELLED') {
      pushAvailability(before.room.channexRoomTypeId, before.checkInDate, before.checkOutDate, 1).catch(console.error)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al cancelar reserva' }, { status: 500 })
  }
}
