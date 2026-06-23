import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const month = searchParams.get('month') // YYYY-MM

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (month) {
    const [y, m] = month.split('-').map(Number)
    where.issueDate = {
      gte: new Date(y, m - 1, 1),
      lt: new Date(y, m, 1),
    }
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      booking: {
        include: { guest: true, room: true },
      },
    },
    orderBy: { issueDate: 'desc' },
  })

  return NextResponse.json(invoices)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { bookingId, notes, dueDate } = body

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { invoice: true },
  })

  if (!booking) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
  if (booking.invoice) return NextResponse.json({ error: 'Esta reserva ya tiene factura' }, { status: 409 })

  // Generate sequential invoice number: FAC-YYYY-XXXX
  const year = new Date().getFullYear()
  const count = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: `FAC-${year}-` } },
  })
  const invoiceNumber = `FAC-${year}-${String(count + 1).padStart(4, '0')}`

  const total = Number(booking.totalAmount)
  const taxRate = 0.1
  const base = total / (1 + taxRate)
  const tax = total - base

  const invoice = await prisma.invoice.create({
    data: {
      bookingId,
      invoiceNumber,
      total: booking.totalAmount,
      tax: tax.toFixed(2),
      status: 'ISSUED',
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes ?? null,
    },
    include: {
      booking: { include: { guest: true, room: true } },
    },
  })

  return NextResponse.json(invoice, { status: 201 })
}
