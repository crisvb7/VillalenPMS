import { prisma } from '@/lib/prisma'
import { ChannelsPageClient } from './ChannelsPageClient'

export const dynamic = 'force-dynamic'

export default async function CanalesPage() {
  const [channexConfig, rooms, icalFeeds] = await Promise.all([
    prisma.channelConfig.findUnique({ where: { channel: 'channex' } }),
    prisma.room.findMany({ orderBy: { name: 'asc' } }),
    prisma.iCalFeed.findMany({ include: { room: true }, orderBy: [{ room: { name: 'asc' } }, { platform: 'asc' }] }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Canales de reservas</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Conecta Booking.com, Airbnb y otras plataformas mediante sincronización iCal
        </p>
      </div>
      <ChannelsPageClient
        channexConfig={JSON.parse(JSON.stringify(channexConfig))}
        rooms={JSON.parse(JSON.stringify(rooms))}
        initialFeeds={JSON.parse(JSON.stringify(icalFeeds))}
      />
    </div>
  )
}
