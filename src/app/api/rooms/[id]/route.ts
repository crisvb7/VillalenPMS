import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        bookings: {
          include: { guest: true },
          orderBy: { checkInDate: 'desc' },
          take: 20,
        },
      },
    })
    if (!room) return NextResponse.json({ error: 'Habitación no encontrada' }, { status: 404 })
    return NextResponse.json(room)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener habitación' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()
    const room = await prisma.room.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.capacity !== undefined && { capacity: Number(body.capacity) }),
        ...(body.basePrice !== undefined && { basePrice: Number(body.basePrice) }),
        ...(body.isClean !== undefined && { isClean: Boolean(body.isClean) }),
        ...(body.channexRoomTypeId !== undefined && { channexRoomTypeId: body.channexRoomTypeId || null }),
      },
    })
    return NextResponse.json(room)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar habitación' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    await prisma.room.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar habitación' }, { status: 500 })
  }
}
