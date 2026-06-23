import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { bookings: true } } },
    })
    return NextResponse.json(rooms)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener habitaciones' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, capacity, basePrice } = await req.json()
    if (!name || !capacity || basePrice === undefined) {
      return NextResponse.json({ error: 'Faltan campos requeridos: name, capacity, basePrice' }, { status: 400 })
    }
    const room = await prisma.room.create({
      data: { name, capacity: Number(capacity), basePrice: Number(basePrice) },
    })
    return NextResponse.json(room, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear habitación' }, { status: 500 })
  }
}
