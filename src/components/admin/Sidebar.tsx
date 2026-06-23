'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  CalendarDays,
  ClipboardList,
  Users,
  BedDouble,
  Sparkles,
  Home,
  ChevronRight,
  Receipt,
  Globe,
} from 'lucide-react'

const navItems = [
  { href: '/admin/reservas', label: 'Reservas', icon: ClipboardList },
  { href: '/admin/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/admin/facturacion', label: 'Facturación', icon: Receipt },
  { href: '/admin/huespedes', label: 'Huéspedes', icon: Users },
  { href: '/admin/habitaciones', label: 'Habitaciones', icon: BedDouble },
  { href: '/admin/limpieza', label: 'Limpieza', icon: Sparkles },
  { href: '/admin/canales', label: 'Canales OTA', icon: Globe },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col text-white" style={{ background: '#163300' }}>
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: '#9FE870' }}>
          <Home className="h-4 w-4" style={{ color: '#163300' }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Casa La Aldea</p>
          <p className="text-xs text-white/50">PMS · Gestión</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-0.5 px-3">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'font-semibold shadow-sm'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                  style={active ? { background: '#9FE870', color: '#163300' } : undefined}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {active && <ChevronRight className="h-3.5 w-3.5 opacity-70" />}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 p-4">
        <p className="px-3 text-xs text-white/30">© Casa La Aldea · PMS</p>
      </div>
    </aside>
  )
}
