import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncIcalFeed } from '@/lib/ical'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const feeds = await prisma.iCalFeed.findMany({ include: { room: true } })

  if (feeds.length === 0) {
    return NextResponse.json({ message: 'No hay feeds iCal configurados', results: [] })
  }

  const results = await Promise.all(
    feeds.map(async (feed) => {
      const stats = await syncIcalFeed(feed.id, feed.roomId, feed.platform, feed.url)
      return { room: feed.room.name, platform: feed.platform, ...stats }
    })
  )

  const totalCreated   = results.reduce((s, r) => s + r.created, 0)
  const totalCancelled = results.reduce((s, r) => s + r.cancelled, 0)

  return NextResponse.json({ results, totalCreated, totalCancelled })
}
