import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const room = await prisma.room.findUnique({ where: { id } })
    if (!room) return NextResponse.json({ error: 'Habitación no encontrada' }, { status: 404 })
    const updated = await prisma.room.update({
      where: { id },
      data: { isClean: !room.isClean },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al cambiar estado de limpieza' }, { status: 500 })
  }
}
