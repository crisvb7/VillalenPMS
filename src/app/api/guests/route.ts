import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')

    const guests = await prisma.guest.findMany({
      where: q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { documentId: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: { _count: { select: { bookings: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(guests)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener huéspedes' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, documentId, email, phone } = await req.json()
    if (!firstName || !lastName || !documentId || !email) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }
    const guest = await prisma.guest.upsert({
      where: { documentId },
      update: { firstName, lastName, email, phone: phone || null },
      create: { firstName, lastName, documentId, email, phone: phone || null },
    })
    return NextResponse.json(guest, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear huésped' }, { status: 500 })
  }
}
