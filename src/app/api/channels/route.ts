import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const configs = await prisma.channelConfig.findMany({ orderBy: { channel: 'asc' } })
  return NextResponse.json(configs)
}

export async function POST(req: NextRequest) {
  const { channel, apiKey, propertyId, webhookSecret, active } = await req.json()
  if (!channel) return NextResponse.json({ error: 'channel is required' }, { status: 400 })

  const config = await prisma.channelConfig.upsert({
    where: { channel },
    update: {
      ...(apiKey !== undefined && { apiKey }),
      ...(propertyId !== undefined && { propertyId }),
      ...(webhookSecret !== undefined && { webhookSecret }),
      ...(active !== undefined && { active: Boolean(active) }),
    },
    create: {
      channel,
      apiKey: apiKey || null,
      propertyId: propertyId || null,
      webhookSecret: webhookSecret || null,
      active: Boolean(active),
    },
  })

  return NextResponse.json(config)
}
