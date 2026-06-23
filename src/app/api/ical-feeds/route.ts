import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const feeds = await prisma.iCalFeed.findMany({
    include: { room: true },
    orderBy: [{ room: { name: 'asc' } }, { platform: 'asc' }],
  })
  return NextResponse.json(feeds)
}

export async function POST(req: NextRequest) {
  const { roomId, platform, url } = await req.json()
  if (!roomId || !platform || !url) {
    return NextResponse.json({ error: 'roomId, platform y url son obligatorios' }, { status: 400 })
  }

  const feed = await prisma.iCalFeed.upsert({
    where: { roomId_platform: { roomId, platform } },
    update: { url },
    create: { roomId, platform, url },
    include: { room: true },
  })
  return NextResponse.json(feed, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.iCalFeed.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
