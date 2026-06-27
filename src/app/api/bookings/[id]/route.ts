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
    const { status, depositPaid, notes, checkInDate, checkOutDate, roomId } = body

    const before = await prisma.booking.findUnique({ where: { id }, include: { room: true } })
    if (!before) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    // Anti-overbooking: validar si cambian habitación o fechas
    if (roomId !== undefined || checkInDate !== undefined || checkOutDate !== undefined) {
      const targetRoomId = roomId ?? before.roomId
      const targetCheckIn = checkInDate ? new Date(checkInDate) : before.checkInDate
      const targetCheckOut = checkOutDate ? new Date(checkOutDate) : before.checkOutDate

      const conflict = await prisma.booking.findFirst({
        where: {
          id: { not: id },
          roomId: targetRoomId,
          status: { notIn: ['CANCELLED', 'CHECKED_OUT'] },
          checkInDate: { lt: targetCheckOut },
          checkOutDate: { gt: targetCheckIn },
        },
      })
      if (conflict) {
        return NextResponse.json(
          { error: 'La habitación ya está ocupada en esas fechas' },
          { status: 409 }
        )
      }
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        ...(status !== undefined && { status: status as BookingStatus }),
        ...(depositPaid !== undefined && { depositPaid: Boolean(depositPaid) }),
        ...(notes !== undefined && { notes }),
        ...(checkInDate !== undefined && { checkInDate: new Date(checkInDate) }),
        ...(checkOutDate !== undefined && { checkOutDate: new Date(checkOutDate) }),
        ...(roomId !== undefined && { roomId }),
      },
      include: { guest: true, room: true },
    })

    // Channex: sincronizar disponibilidad
    const becomingCancelled = status === 'CANCELLED' && before.status !== 'CANCELLED'
    const roomChanged = roomId !== undefined && roomId !== before.roomId
    const datesOrRoomChanged = roomChanged || checkInDate !== undefined || checkOutDate !== undefined

    if (becomingCancelled) {
      if (before.room.channexRoomTypeId) {
        pushAvailability(before.room.channexRoomTypeId, before.checkInDate, before.checkOutDate, 1).catch(console.error)
      }
    } else if (datesOrRoomChanged && before.status !== 'CANCELLED') {
      const newCheckIn = checkInDate ? new Date(checkInDate) : before.checkInDate
      const newCheckOut = checkOutDate ? new Date(checkOutDate) : before.checkOutDate
      // Abrir slot antiguo
      if (before.room.channexRoomTypeId) {
        pushAvailability(before.room.channexRoomTypeId, before.checkInDate, before.checkOutDate, 1).catch(console.error)
      }
      if (roomChanged) {
        // Bloquear slot en habitación nueva
        const newRoom = await prisma.room.findUnique({ where: { id: roomId } })
        if (newRoom?.channexRoomTypeId) {
          pushAvailability(newRoom.channexRoomTypeId, newCheckIn, newCheckOut, 0).catch(console.error)
        }
      } else if (before.room.channexRoomTypeId) {
        // Misma habitación, fechas cambiadas — bloquear nuevas fechas
        pushAvailability(before.room.channexRoomTypeId, newCheckIn, newCheckOut, 0).catch(console.error)
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
