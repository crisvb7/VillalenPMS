import { prisma } from '@/lib/prisma'
import { BookingsTable } from '@/components/admin/BookingsTable'
import { StatCard } from '@/components/admin/StatsCards'
import { ClipboardList, TrendingUp, BedDouble, CalendarCheck, LogOut, Euro } from 'lucide-react'
import { differenceInCalendarDays } from 'date-fns'
import { formatCurrency, formatDate, toDecimalNumber } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ReservasPage() {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const next7 = new Date(today); next7.setDate(next7.getDate() + 7)

  const [
    allBookings,
    totalRooms,
    occupiedToday,
    checkInsToday,
    checkOutsToday,
    monthBookings,
    upcomingArrivals,
  ] = await Promise.all([
    prisma.booking.findMany({
      where: { status: { notIn: ['CANCELLED'] } },
      include: { guest: true, room: true, invoice: true },
      orderBy: { checkInDate: 'asc' },
    }),
    prisma.room.count(),
    prisma.booking.count({
      where: {
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        checkInDate: { lte: today },
        checkOutDate: { gt: today },
      },
    }),
    prisma.booking.count({
      where: { checkInDate: { gte: today, lt: tomorrow }, status: { notIn: ['CANCELLED'] } },
    }),
    prisma.booking.count({
      where: { checkOutDate: { gte: today, lt: tomorrow }, status: { notIn: ['CANCELLED'] } },
    }),
    prisma.booking.findMany({
      where: {
        status: { notIn: ['CANCELLED'] },
        checkInDate: { gte: monthStart, lte: monthEnd },
      },
      select: { totalAmount: true, checkInDate: true, checkOutDate: true },
    }),
    prisma.booking.findMany({
      where: {
        checkInDate: { gte: today, lte: next7 },
        status: { notIn: ['CANCELLED'] },
      },
      include: { guest: true, room: true },
      orderBy: { checkInDate: 'asc' },
      take: 8,
    }),
  ])

  const occupancyRate = totalRooms > 0 ? Math.round((occupiedToday / totalRooms) * 100) : 0
  const monthRevenue = monthBookings.reduce((sum, b) => sum + toDecimalNumber(b.totalAmount), 0)
  const monthNights = monthBookings.reduce((sum, b) => sum + Math.max(0, differenceInCalendarDays(new Date(b.checkOutDate), new Date(b.checkInDate))), 0)
  const adr = monthNights > 0 ? monthRevenue / monthNights : 0
  const pending = allBookings.filter((b: (typeof allBookings)[0]) => b.status === 'PENDING')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Panel de reservas</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {allBookings.length} reservas activas
            {pending.length > 0 && (
              <span className="ml-2 font-semibold text-amber-600">· {pending.length} pendientes de confirmar</span>
            )}
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Ocupación hoy"
          value={`${occupancyRate}%`}
          subtitle={`${occupiedToday} de ${totalRooms} hab.`}
          icon={BedDouble}
          color="brand"
        />
        <StatCard
          title="Ingresos este mes"
          value={formatCurrency(monthRevenue)}
          subtitle={`${monthBookings.length} reservas`}
          icon={Euro}
          color="emerald"
        />
        <StatCard
          title="ADR este mes"
          value={formatCurrency(adr)}
          subtitle="precio medio/noche"
          icon={TrendingUp}
          color="sky"
        />
        <StatCard
          title="Check-ins hoy"
          value={checkInsToday}
          icon={CalendarCheck}
          color="emerald"
        />
        <StatCard
          title="Check-outs hoy"
          value={checkOutsToday}
          icon={LogOut}
          color="amber"
        />
        <StatCard
          title="Sin confirmar"
          value={pending.length}
          subtitle="requieren acción"
          icon={ClipboardList}
          color={pending.length > 0 ? 'rose' : 'brand'}
        />
      </div>

      {/* Upcoming arrivals */}
      {upcomingArrivals.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Próximas llegadas (7 días)
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {upcomingArrivals.map((b: (typeof upcomingArrivals)[0]) => {
              const nights = differenceInCalendarDays(new Date(b.checkOutDate), new Date(b.checkInDate))
              const isToday = new Date(b.checkInDate).toDateString() === today.toDateString()
              return (
                <div
                  key={b.id}
                  className={`rounded-xl border bg-white p-4 shadow-sm ${isToday ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {b.guest.firstName} {b.guest.lastName}
                      </p>
                      <p className="text-xs text-slate-500">{b.room.name} · {nights}n</p>
                    </div>
                    {isToday && (
                      <span className="ml-2 flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                        HOY
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}
                  </p>
                  <p className="text-xs font-semibold text-slate-700">{formatCurrency(b.totalAmount)}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Full bookings table */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Todas las reservas</h2>
        <BookingsTable bookings={JSON.parse(JSON.stringify(allBookings))} />
      </div>
    </div>
  )
}
