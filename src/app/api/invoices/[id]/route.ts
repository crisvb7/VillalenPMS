import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { booking: { include: { guest: true, room: true } } },
  })
  if (!invoice) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json(invoice)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { status, paymentMethod, notes } = body

  const invoice = await prisma.invoice.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(paymentMethod !== undefined && { paymentMethod: paymentMethod || null }),
      ...(notes !== undefined && { notes }),
    },
    include: { booking: { include: { guest: true, room: true } } },
  })

  return NextResponse.json(invoice)
}
