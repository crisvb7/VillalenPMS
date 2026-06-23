import { prisma } from '@/lib/prisma'
import { CleaningGrid } from '@/components/admin/CleaningGrid'
import { Sparkles } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function LimpiezaPage() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const rooms = await prisma.room.findMany({
    orderBy: { name: 'asc' },
    include: {
      bookings: {
        where: {
          checkInDate: { lte: today },
          checkOutDate: { gt: today },
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        },
        include: { guest: true },
        take: 1,
      },
    },
  })

  const roomsWithGuest = rooms.map((room: (typeof rooms)[0]) => ({
    ...room,
    currentGuest: room.bookings[0]
      ? `${room.bookings[0].guest.firstName} ${room.bookings[0].guest.lastName}`
      : null,
  }))

  const cleanCount = rooms.filter((r: (typeof rooms)[0]) => r.isClean).length
  const dirtyCount = rooms.length - cleanCount

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-indigo-500" />
          <h1 className="text-2xl font-bold text-slate-800">Estado de limpieza</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          <span className="font-semibold text-emerald-600">{cleanCount} limpias</span>
          {dirtyCount > 0 && (
            <>
              {' · '}
              <span className="font-semibold text-amber-600">{dirtyCount} necesitan limpieza</span>
            </>
          )}
        </p>
      </div>

      <CleaningGrid rooms={roomsWithGuest} />
    </div>
  )
}
