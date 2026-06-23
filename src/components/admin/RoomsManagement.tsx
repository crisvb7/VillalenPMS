'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BedDouble, Plus, Pencil, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Room } from '@/types'

interface RoomsManagementProps {
  rooms: (Room & { _count: { bookings: number } })[]
}

function RoomForm({
  room,
  onClose,
}: {
  room?: Room | null
  onClose: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: room?.name ?? '',
    capacity: room?.capacity?.toString() ?? '',
    basePrice: room ? Number(room.basePrice).toString() : '',
  })
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const method = room ? 'PUT' : 'POST'
      const url = room ? `/api/rooms/${room.id}` : '/api/rooms'
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          capacity: Number(form.capacity),
          basePrice: Number(form.basePrice),
        }),
      })
      router.refresh()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-slate-800">
          {room ? 'Editar habitación' : 'Nueva habitación'}
        </h3>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Ej: El Henar"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Capacidad</label>
              <input
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Precio/noche (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.basePrice}
                onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function RoomsManagement({ rooms }: RoomsManagementProps) {
  const router = useRouter()
  const [editRoom, setEditRoom] = useState<Room | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function deleteRoom(id: string) {
    if (!confirm('¿Eliminar esta habitación? Esta acción no se puede deshacer.')) return
    setDeleting(id)
    try {
      await fetch(`/api/rooms/${id}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      {editRoom !== undefined && (
        <RoomForm room={editRoom} onClose={() => setEditRoom(undefined)} />
      )}

      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setEditRoom(null)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Nueva habitación
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <div key={room.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-50 p-2.5 text-indigo-600">
                  <BedDouble className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{room.name}</h3>
                  <p className="text-xs text-slate-500">{room.capacity} personas</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setEditRoom(room)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteRoom(room.id)}
                  disabled={deleting === room.id}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <div>
                <p className="text-xs text-slate-400">Precio por noche</p>
                <p className="text-lg font-bold text-slate-800">{formatCurrency(room.basePrice)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Total reservas</p>
                <p className="text-lg font-bold text-indigo-600">{room._count.bookings}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
