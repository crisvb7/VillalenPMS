'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Room } from '@/types'
import { Sparkles, AlertCircle, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CleaningGridProps {
  rooms: (Room & { currentGuest?: string | null })[]
}

export function CleaningGrid({ rooms }: CleaningGridProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function toggleClean(id: string) {
    setLoading(id)
    try {
      await fetch(`/api/rooms/${id}/clean`, { method: 'PATCH' })
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rooms.map((room) => (
        <div
          key={room.id}
          className={cn(
            'relative overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:shadow-md',
            room.isClean ? 'border-emerald-200' : 'border-amber-200'
          )}
        >
          <div className={cn('h-1.5 w-full', room.isClean ? 'bg-emerald-400' : 'bg-amber-400')} />

          <div className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-800">{room.name}</h3>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <Users className="h-3 w-3" />
                  Capacidad: {room.capacity} personas
                </p>
              </div>
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full',
                  room.isClean ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                )}
              >
                {room.isClean ? <Sparkles className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              </div>
            </div>

            {room.currentGuest && (
              <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2">
                <p className="text-xs font-medium text-blue-700">Huésped actual</p>
                <p className="text-sm text-blue-800">{room.currentGuest}</p>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                  room.isClean
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    room.isClean ? 'bg-emerald-500' : 'bg-amber-500'
                  )}
                />
                {room.isClean ? 'Limpia' : 'Necesita limpieza'}
              </span>

              <button
                onClick={() => toggleClean(room.id)}
                disabled={loading === room.id}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50',
                  room.isClean
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                )}
              >
                {loading === room.id ? '...' : room.isClean ? 'Marcar sucia' : 'Marcar limpia'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
