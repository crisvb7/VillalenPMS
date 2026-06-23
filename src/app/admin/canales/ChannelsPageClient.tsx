'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, RefreshCw, CheckCircle, AlertCircle, Calendar, ExternalLink, Copy } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { ChannelConfig, Room } from '@/types'

interface ICalFeedRow {
  id: string
  roomId: string
  platform: string
  url: string
  lastSync: string | null
  lastError: string | null
  room: { name: string }
}

interface Props {
  channexConfig: ChannelConfig | null
  rooms: Room[]
  initialFeeds: ICalFeedRow[]
}

const PLATFORMS = [
  { value: 'booking_com', label: 'Booking.com', color: '#003580' },
  { value: 'airbnb', label: 'Airbnb', color: '#ff5a5f' },
  { value: 'expedia', label: 'Expedia', color: '#ffc72c' },
  { value: 'vrbo', label: 'VRBO', color: '#1551B5' },
  { value: 'other', label: 'Otro', color: '#64748b' },
]

function getPlatformLabel(value: string) {
  return PLATFORMS.find((p) => p.value === value)?.label ?? value
}
function getPlatformColor(value: string) {
  return PLATFORMS.find((p) => p.value === value)?.color ?? '#64748b'
}

export function ChannelsPageClient({ rooms, initialFeeds }: Props) {
  const [feeds, setFeeds] = useState<ICalFeedRow[]>(initialFeeds)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  // Add feed form
  const [addingFeed, setAddingFeed] = useState(false)
  const [newRoomId, setNewRoomId] = useState(rooms[0]?.id ?? '')
  const [newPlatform, setNewPlatform] = useState('booking_com')
  const [newUrl, setNewUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])

  async function syncNow() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync/ical', { method: 'POST' })
      const data = await res.json()
      if (data.results?.length === 0) {
        setSyncResult('No hay feeds configurados aún.')
      } else {
        setSyncResult(
          data.results.map((r: { room: string; platform: string; created: number; cancelled: number; error?: string }) =>
            r.error
              ? `${r.room} (${getPlatformLabel(r.platform)}): Error — ${r.error}`
              : `${r.room} (${getPlatformLabel(r.platform)}): +${r.created} nuevas, ${r.cancelled} canceladas`
          ).join('\n')
        )
        // Refresh feeds list
        const fresh = await fetch('/api/ical-feeds').then((r) => r.json())
        setFeeds(fresh)
      }
    } finally {
      setSyncing(false)
    }
  }

  async function addFeed() {
    if (!newUrl.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/ical-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: newRoomId, platform: newPlatform, url: newUrl.trim() }),
      })
      if (res.ok) {
        const feed = await res.json()
        setFeeds((prev) => [...prev.filter((f) => !(f.roomId === feed.roomId && f.platform === feed.platform)), feed])
        setAddingFeed(false)
        setNewUrl('')
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteFeed(id: string) {
    if (!confirm('¿Eliminar este feed?')) return
    await fetch('/api/ical-feeds', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setFeeds((prev) => prev.filter((f) => f.id !== id))
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* iCal import section */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" style={{ color: '#163300' }} />
            <h2 className="text-sm font-bold text-slate-800">Importar reservas (iCal)</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={syncNow}
              disabled={syncing}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#163300' }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
            <button
              onClick={() => setAddingFeed(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Añadir feed
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-500">
            Pega la URL iCal de cada habitación desde Booking.com y Airbnb. Las reservas se importarán
            automáticamente al sincronizar.
          </p>

          {/* Feed list */}
          {feeds.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center">
              <Calendar className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">No hay feeds configurados</p>
              <p className="text-xs text-slate-400 mt-1">Añade tu primer feed con el botón de arriba</p>
            </div>
          ) : (
            <div className="space-y-2">
              {feeds.map((feed) => (
                <div key={feed.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div
                    className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ background: getPlatformColor(feed.platform) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">{feed.room.name}</span>
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ background: getPlatformColor(feed.platform) }}>
                        {getPlatformLabel(feed.platform)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{feed.url}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs">
                      {feed.lastError ? (
                        <span className="flex items-center gap-1 text-red-500">
                          <AlertCircle className="h-3 w-3" /> {feed.lastError}
                        </span>
                      ) : feed.lastSync ? (
                        <span className="flex items-center gap-1 text-slate-400">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          Última sync: {formatDate(feed.lastSync)}
                        </span>
                      ) : (
                        <span className="text-slate-400">Sin sincronizar aún</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => deleteFeed(feed.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Sync result */}
          {syncResult && (
            <div className="rounded-xl p-3 text-xs" style={{ background: '#edfce5', color: '#163300' }}>
              <pre className="whitespace-pre-wrap font-sans">{syncResult}</pre>
            </div>
          )}

          {/* Add feed form */}
          {addingFeed && (
            <div className="rounded-xl border border-slate-200 p-4 space-y-3" style={{ background: '#f8fafc' }}>
              <p className="text-xs font-semibold text-slate-600">Nuevo feed iCal</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Habitación</label>
                  <select
                    value={newRoomId}
                    onChange={(e) => setNewRoomId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:outline-none focus:border-[#163300]"
                  >
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Plataforma</label>
                  <select
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:outline-none focus:border-[#163300]"
                  >
                    {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">URL iCal</label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://admin.booking.com/hotel/hoteladmin/ical.html?t=..."
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-mono focus:outline-none focus:border-[#163300]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setAddingFeed(false); setNewUrl('') }}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={addFeed}
                  disabled={saving || !newUrl.trim()}
                  className="flex-1 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: '#163300' }}
                >
                  {saving ? 'Guardando…' : 'Guardar feed'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* iCal export section */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
          <ExternalLink className="h-4 w-4" style={{ color: '#163300' }} />
          <h2 className="text-sm font-bold text-slate-800">Exportar disponibilidad (iCal)</h2>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-xs text-slate-500">
            Suscribe estas URLs en Booking.com y Airbnb para que bloqueen automáticamente
            las fechas que ya tienes reservadas en tu PMS.
          </p>
          {rooms.map((room) => {
            const url = `${origin}/api/ical/${room.id}`
            return (
              <div key={room.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 mb-0.5">{room.name}</p>
                  <p className="text-xs font-mono text-slate-500 truncate">{url}</p>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(url)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 flex-shrink-0"
                >
                  <Copy className="h-3 w-3" /> Copiar
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* How to get iCal URLs */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-800 mb-4">Cómo obtener la URL iCal</h2>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-[#003580] mb-2">Booking.com</p>
            <ol className="space-y-1 text-xs text-slate-600 list-decimal list-inside">
              <li>Inicia sesión en la Extranet de Booking.com</li>
              <li>Ve a <strong>Calendario</strong> → <strong>Sincronizar disponibilidad</strong></li>
              <li>Haz clic en <strong>Exportar a iCal</strong> y copia la URL</li>
              <li>Repite para cada habitación/tipo de alojamiento</li>
            </ol>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#ff5a5f] mb-2">Airbnb</p>
            <ol className="space-y-1 text-xs text-slate-600 list-decimal list-inside">
              <li>Ve a <strong>Anuncios</strong> → selecciona tu alojamiento</li>
              <li>Haz clic en <strong>Disponibilidad</strong> → <strong>Conexión de calendarios</strong></li>
              <li>Haz clic en <strong>Exportar calendario</strong> y copia la URL</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
