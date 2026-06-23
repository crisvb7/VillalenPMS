import { prisma } from '@/lib/prisma'
import { RoomsManagement } from '@/components/admin/RoomsManagement'
import { BedDouble } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function HabitacionesPage() {
  const rooms = await prisma.room.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { bookings: true } } },
  })

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <BedDouble className="h-6 w-6 text-indigo-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Habitaciones</h1>
          <p className="mt-0.5 text-sm text-slate-500">{rooms.length} habitaciones configuradas</p>
        </div>
      </div>

      <RoomsManagement rooms={rooms} />
    </div>
  )
}
