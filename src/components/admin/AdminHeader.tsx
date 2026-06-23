'use client'

import { useState } from 'react'
import { Plus, Bell } from 'lucide-react'
import { NewBookingModal } from './NewBookingModal'
import { formatDateLong } from '@/lib/utils'

export function AdminHeader() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
        <p className="text-sm text-slate-500" suppressHydrationWarning>{formatDateLong(new Date())}</p>
        <div className="flex items-center gap-2">
          <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <Bell className="h-4 w-4" />
          </button>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors shadow-sm"
            style={{ background: '#163300' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1e4700')}
            onMouseLeave={e => (e.currentTarget.style.background = '#163300')}
          >
            <Plus className="h-4 w-4" />
            Nueva reserva
          </button>
        </div>
      </header>

      <NewBookingModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
