'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { addDays } from 'date-fns'

const PLATFORM_LABELS: Record<string, string> = {
  booking_com: 'Booking.com',
  airbnb:      'Airbnb',
  web:         'Web (propia)',
}

interface Feed { id: string; platform: string }

interface BlockDatesModalProps {
  open: boolean
  roomId: string | null
  defaultStart: string
  defaultEnd: string
  onClose: () => void
  onCreated: () => void
}

export function BlockDatesModal({
  open, roomId, defaultStart, defaultEnd, onClose, onCreated,
}: BlockDatesModalProps) {
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate]     = useState(defaultEnd)
  const [feeds, setFeeds]         = useState<Feed[]>([])
  const [selected, setSelected]   = useState<string[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    setStartDate(defaultStart)
    setEndDate(defaultEnd)
  }, [defaultStart, defaultEnd])

  useEffect(() => {
    if (!open || !roomId) return
    fetch(`/api/ical-feeds?roomId=${roomId}`)
      .then((r) => r.json())
      .then((data: Feed[]) => {
        setFeeds(data)
        setSelected([])
        setError(null)
      })
  }, [open, roomId])

  if (!open || !roomId) return null

  const allPlatforms = [
    ...feeds.map((f) => f.platform),
    'web',
  ].filter((v, i, arr) => arr.indexOf(v) === i)

  function togglePlatform(platform: string) {
    setSelected((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected.length) { setError('Selecciona al menos una plataforma'); return }
    if (!startDate || !endDate) { setError('Indica el rango de fechas'); return }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/availability-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          startDate: new Date(startDate).toISOString(),
          endDate:   addDays(new Date(endDate), 1).toISOString(),
          platforms: selected,
          reason:    'CLOSED',
        }),
      })
      if (!res.ok) throw new Error('Error al crear el bloqueo')
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Bloquear fechas</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Desde</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                required
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Hasta</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-600">Cerrar en</label>
            <div className="space-y-2">
              {allPlatforms.map((platform) => (
                <label key={platform} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selected.includes(platform)}
                    onChange={() => togglePlatform(platform)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-300"
                  />
                  <span className="text-sm text-slate-700">
                    {PLATFORM_LABELS[platform] ?? platform}
                  </span>
                </label>
              ))}
              {allPlatforms.length === 0 && (
                <p className="text-xs text-slate-400">No hay plataformas conectadas a esta habitación.</p>
              )}
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
              style={{ background: '#163300' }}
            >
              {loading ? 'Bloqueando…' : 'Bloquear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
