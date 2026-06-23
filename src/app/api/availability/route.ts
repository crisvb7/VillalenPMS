import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const checkIn = searchParams.get('checkIn')
    const checkOut = searchParams.get('checkOut')

    if (!checkIn || !checkOut) {
      return NextResponse.json({ error: 'Se requieren checkIn y checkOut' }, { status: 400 })
    }

    const checkInDate = new Date(checkIn)
    const checkOutDate = new Date(checkOut)

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 })
    }
    if (checkInDate >= checkOutDate) {
      return NextResponse.json({ error: 'checkOut debe ser posterior a checkIn' }, { status: 400 })
    }

    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / 86400000)

    const bookedRoomIds = await prisma.booking.findMany({
      where: {
        status: { notIn: ['CANCELLED'] },
        AND: [{ checkInDate: { lt: checkOutDate } }, { checkOutDate: { gt: checkInDate } }],
      },
      select: { roomId: true },
    })

    const occupiedIds = bookedRoomIds.map((b: { roomId: string }) => b.roomId)

    const availableRooms = await prisma.room.findMany({
      where: { id: { notIn: occupiedIds } },
      orderBy: { basePrice: 'asc' },
    })

    const result = availableRooms.map((room: (typeof availableRooms)[0]) => ({
      room,
      available: true,
      pricePerNight: Number(room.basePrice),
      totalNights: nights,
      totalPrice: Number(room.basePrice) * nights,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al comprobar disponibilidad' }, { status: 500 })
  }
}
