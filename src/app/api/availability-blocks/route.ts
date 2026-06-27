import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const from   = searchParams.get('from')
  const to     = searchParams.get('to')
  const roomId = searchParams.get('roomId')

  const blocks = await prisma.availabilityBlock.findMany({
    where: {
      ...(roomId && { roomId }),
      ...(from && to && {
        startDate: { lt: new Date(to) },
        endDate:   { gt: new Date(from) },
      }),
    },
    orderBy: { startDate: 'asc' },
  })
  return NextResponse.json(blocks)
}

export async function POST(req: NextRequest) {
  const { roomId, startDate, endDate, platforms, reason } = await req.json()

  if (!roomId || !startDate || !endDate || !platforms?.length) {
    return NextResponse.json(
      { error: 'roomId, startDate, endDate y platforms son obligatorios' },
      { status: 400 }
    )
  }

  const block = await prisma.availabilityBlock.create({
    data: {
      roomId,
      startDate: new Date(startDate),
      endDate:   new Date(endDate),
      platforms,
      reason:    reason ?? null,
      source:    'manual',
    },
  })
  return NextResponse.json(block, { status: 201 })
}
