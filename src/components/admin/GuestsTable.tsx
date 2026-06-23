import type { Guest } from '@/types'
import { formatDate } from '@/lib/utils'
import { Users } from 'lucide-react'

interface GuestsTableProps {
  guests: (Guest & { _count: { bookings: number }; lastBooking?: { checkInDate: Date } | null })[]
}

export function GuestsTable({ guests }: GuestsTableProps) {
  if (guests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16">
        <Users className="mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm text-slate-500">No hay huéspedes registrados</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50">
          <tr>
            {['Nombre', 'DNI/Pasaporte', 'Email', 'Teléfono', 'Reservas', 'Última visita'].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {guests.map((g) => (
            <tr key={g.id} className="hover:bg-slate-50/60 transition-colors">
              <td className="px-4 py-3.5">
                <p className="text-sm font-semibold text-slate-800">
                  {g.firstName} {g.lastName}
                </p>
              </td>
              <td className="px-4 py-3.5">
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                  {g.documentId}
                </span>
              </td>
              <td className="px-4 py-3.5 text-sm text-slate-600">{g.email}</td>
              <td className="px-4 py-3.5 text-sm text-slate-500">{g.phone ?? '—'}</td>
              <td className="px-4 py-3.5">
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  {g._count.bookings}
                </span>
              </td>
              <td className="px-4 py-3.5 text-sm text-slate-500">
                {g.lastBooking ? formatDate(g.lastBooking.checkInDate) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
