import { prisma } from '@/lib/prisma'
import { GuestsTable } from '@/components/admin/GuestsTable'
import { Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function HuespedesPage() {
  const guests = await prisma.guest.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { bookings: true } },
      bookings: {
        select: { checkInDate: true },
        orderBy: { checkInDate: 'desc' },
        take: 1,
      },
    },
  })

  const guestsWithLastBooking = guests.map((g: (typeof guests)[0]) => ({
    ...g,
    lastBooking: g.bookings[0] ?? null,
  }))

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Users className="h-6 w-6 text-indigo-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Huéspedes</h1>
          <p className="mt-0.5 text-sm text-slate-500">{guests.length} huéspedes registrados</p>
        </div>
      </div>

      <GuestsTable guests={guestsWithLastBooking} />
    </div>
  )
}
