import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guest = await prisma.guest.findUnique({
      where: { id },
      include: {
        bookings: {
          include: { room: true },
          orderBy: { checkInDate: 'desc' },
        },
      },
    })
    if (!guest) return NextResponse.json({ error: 'Huésped no encontrado' }, { status: 404 })
    return NextResponse.json(guest)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener huésped' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()
    const guest = await prisma.guest.update({
      where: { id },
      data: {
        ...(body.firstName !== undefined && { firstName: body.firstName }),
        ...(body.lastName !== undefined && { lastName: body.lastName }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.phone !== undefined && { phone: body.phone }),
      },
    })
    return NextResponse.json(guest)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar huésped' }, { status: 500 })
  }
}
