# Sidebar colapsable, calendario deslizante y bloques de disponibilidad

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir sidebar colapsable, navegación día-a-día con selector mes/año en el calendario, y un sistema de bloques de disponibilidad por plataforma (Booking.com, Airbnb, Web) con fix del bug de iCal sync que importa fechas cerradas como reservas ficticias.

**Architecture:** Sidebar gestionada por nuevo client component `AdminShell`. Calendario refactorizado con `startDate: Date` como eje central (ventana = días del mes de startDate, coordinadas 0-indexed offset). Nuevo modelo `AvailabilityBlock` en DB; iCal sync detecta eventos CLOSED y crea bloques en lugar de reservas; export iCal filtrado por plataforma vía `?platform=` query param.

**Tech Stack:** Next.js 16.2.9 App Router, React 19.2.4, TypeScript, Prisma 7.8.0 + PostgreSQL, date-fns 4.4.0, lucide-react 1.21.0, Tailwind CSS 4.

## Global Constraints

- Next.js App Router: layouts son server components por defecto; client state va en client components hijos.
- Prisma client output en `src/db/` — importar tipos desde `@/db/client`, no desde `@prisma/client`.
- Tipos compartidos en `src/types/index.ts`.
- `cn()` utility en `@/lib/utils`.
- Prisma 7.x: arrays de strings (`String[]`) mapean a `text[]` en PostgreSQL — soportado nativamente.
- No hay framework de tests; verificar con `npx tsc --noEmit` y arranque de dev server.
- Colores de marca: verde `#9FE870`, fondo sidebar `#163300`.
- `BookingSource` enum: `WEB | BOOKING | AIRBNB | MANUAL`.

---

## Task 1: Sidebar colapsable

**Files:**
- Create: `src/components/admin/AdminShell.tsx`
- Modify: `src/components/admin/Sidebar.tsx`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Produces: `AdminShell` — client component que acepta `children: React.ReactNode` y gestiona estado collapsed.

- [ ] **Step 1: Crear `AdminShell.tsx`**

```tsx
// src/components/admin/AdminShell.tsx
'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { AdminHeader } from './AdminHeader'
import { cn } from '@/lib/utils'

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem('sidebar-collapsed') === 'true')
  }, [])

  function toggle() {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev))
      return !prev
    })
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div
        className={cn(
          'flex min-h-screen flex-1 flex-col transition-all duration-200',
          collapsed ? 'pl-14' : 'pl-64'
        )}
      >
        <AdminHeader />
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Actualizar `Sidebar.tsx` para aceptar collapsed/onToggle**

Reemplazar el contenido completo de `src/components/admin/Sidebar.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  CalendarDays, ClipboardList, Users, BedDouble, Sparkles,
  Home, ChevronRight, Receipt, Globe, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'

const navItems = [
  { href: '/admin/reservas',     label: 'Reservas',      icon: ClipboardList },
  { href: '/admin/calendario',   label: 'Calendario',    icon: CalendarDays  },
  { href: '/admin/facturacion',  label: 'Facturación',   icon: Receipt       },
  { href: '/admin/huespedes',    label: 'Huéspedes',     icon: Users         },
  { href: '/admin/habitaciones', label: 'Habitaciones',  icon: BedDouble     },
  { href: '/admin/limpieza',     label: 'Limpieza',      icon: Sparkles      },
  { href: '/admin/canales',      label: 'Canales OTA',   icon: Globe         },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col text-white transition-all duration-200',
        collapsed ? 'w-14' : 'w-64'
      )}
      style={{ background: '#163300' }}
    >
      {/* Header */}
      <div className="flex h-16 items-center border-b border-white/10 px-3 gap-2">
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: '#9FE870' }}
        >
          <Home className="h-4 w-4" style={{ color: '#163300' }} />
        </div>
        {!collapsed && (
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-white truncate">Casa La Aldea</p>
            <p className="text-xs text-white/50">PMS · Gestión</p>
          </div>
        )}
        <button
          onClick={onToggle}
          className="flex-shrink-0 rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed
            ? <PanelLeftOpen className="h-4 w-4" />
            : <PanelLeftClose className="h-4 w-4" />
          }
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-0.5 px-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <li key={href}>
                <Link
                  href={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors',
                    collapsed && 'justify-center px-0',
                    active
                      ? 'font-semibold shadow-sm'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                  style={active ? { background: '#9FE870', color: '#163300' } : undefined}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{label}</span>
                      {active && <ChevronRight className="h-3.5 w-3.5 opacity-70" />}
                    </>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-white/10 p-4">
          <p className="px-3 text-xs text-white/30">© Casa La Aldea · PMS</p>
        </div>
      )}
    </aside>
  )
}
```

- [ ] **Step 3: Actualizar `layout.tsx` para usar `AdminShell`**

```tsx
// src/app/admin/layout.tsx
import { AdminShell } from '@/components/admin/AdminShell'

export const metadata = {
  title: 'PMS · Casa La Aldea',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
```

- [ ] **Step 4: Verificar compilación**

```bash
npx tsc --noEmit
```

Expected: sin errores de tipo.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminShell.tsx src/components/admin/Sidebar.tsx src/app/admin/layout.tsx
git commit -m "feat: add collapsible sidebar with icon-only collapsed mode"
```

---

## Task 2: Calendario con ventana deslizante y selector mes/año

El sistema de coordenadas cambia de `(year, month, daysInMonth)` + día 1-indexado a `(startDate, windowSize)` + offset 0-indexado. La ventana cubre `windowSize = getDaysInMonth(startDate)` días, empezando en `startDate`.

**Files:**
- Modify: `src/components/admin/HotelCalendar.tsx`
- Modify: `src/components/admin/calendar/CalendarHeader.tsx`
- Modify: `src/components/admin/calendar/CalendarGrid.tsx`
- Modify: `src/components/admin/calendar/DayHeaders.tsx`
- Modify: `src/components/admin/calendar/RoomRow.tsx`
- Modify: `src/components/admin/calendar/BookingBar.tsx`

**Interfaces:**
- Consumes: nada nuevo
- Produces:
  - `GhostBar.startDay: number` → `GhostBar.startCol: number` (0-indexed)
  - `CalendarGrid` props: `startDate: Date`, `windowSize: number` (reemplaza `year`, `month`, `daysInMonth`)
  - `CalendarHeader` props: `startDate: Date`, `onPrevDay`, `onNextDay`, `onToday`, `onMonthYearChange(year: number, month: number)`
  - `DayHeaders` props: `startDate: Date`, `windowSize: number`
  - `RoomRow` props: `startDate: Date`, `windowSize: number`; callbacks usan `colOffset: number` (0-indexed)
  - `BookingBar` props: `checkInOffset: number`, `checkOutOffset: number`, `windowSize: number`

- [ ] **Step 1: Actualizar `GhostBar` en `RoomRow.tsx` y lógica interna**

Reemplazar `src/components/admin/calendar/RoomRow.tsx`:

```tsx
'use client'

import { useRef } from 'react'
import { isSameDay, addDays, differenceInCalendarDays } from 'date-fns'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BookingBar } from './BookingBar'
import type { BookingWithRelations } from '@/types'

export interface GhostBar {
  roomId: string
  startCol: number  // 0-indexed offset from startDate
  nights: number
  isValid: boolean
}

interface RoomRowProps {
  room: { id: string; name: string }
  bookings: BookingWithRelations[]
  startDate: Date
  windowSize: number
  colWidth: number
  roomLabelWidth: number
  today: Date
  draggingBookingId: string | null
  ghostBar: GhostBar | null
  onCellClick: (roomId: string, colOffset: number, clientX: number, clientY: number) => void
  onBookingClick: (booking: BookingWithRelations) => void
  onDragStart: (booking: BookingWithRelations, offsetDays: number) => void
  onDragOver: (e: React.DragEvent, roomId: string, colOffset: number) => void
  onDrop: (e: React.DragEvent, roomId: string, colOffset: number) => void
}

export function RoomRow({
  room, bookings, startDate, windowSize, colWidth, roomLabelWidth,
  today, draggingBookingId, ghostBar,
  onCellClick, onBookingClick, onDragStart, onDragOver, onDrop,
}: RoomRowProps) {
  const dayAreaRef = useRef<HTMLDivElement>(null)
  const offsets = Array.from({ length: windowSize }, (_, i) => i)
  const isAnyDragging = draggingBookingId !== null

  function getColOffsetFromEvent(e: React.DragEvent): number {
    if (!dayAreaRef.current) return 0
    const rect = dayAreaRef.current.getBoundingClientRect()
    const relX = e.clientX - rect.left
    return Math.max(0, Math.min(windowSize - 1, Math.floor(relX / colWidth)))
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    onDragOver(e, room.id, getColOffsetFromEvent(e))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    onDrop(e, room.id, getColOffsetFromEvent(e))
  }

  const myGhostBar = ghostBar?.roomId === room.id ? ghostBar : null

  return (
    <div className="flex" style={{ height: 70 }}>
      {/* Room label */}
      <div
        className="sticky left-0 z-10 flex flex-none items-center border-r border-slate-100 bg-white px-4"
        style={{ width: roomLabelWidth, minWidth: roomLabelWidth }}
      >
        <span className="text-sm font-semibold text-slate-700 truncate">{room.name}</span>
      </div>

      {/* Day area */}
      <div
        ref={dayAreaRef}
        className="relative"
        style={{ width: windowSize * colWidth, minWidth: windowSize * colWidth }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Background cells */}
        {offsets.map((colOffset) => {
          const date = addDays(startDate, colOffset)
          const isToday = isSameDay(date, today)
          const dayOfWeek = (date.getDay() + 6) % 7
          const isWeekend = dayOfWeek >= 5
          const hasBooking = bookings.some((b) => {
            const checkIn = differenceInCalendarDays(new Date(b.checkInDate), startDate)
            const checkOut = differenceInCalendarDays(new Date(b.checkOutDate), startDate)
            return (
              !['CANCELLED', 'CHECKED_OUT'].includes(b.status) &&
              colOffset >= checkIn &&
              colOffset < checkOut
            )
          })
          return (
            <div
              key={colOffset}
              style={{ position: 'absolute', left: colOffset * colWidth, width: colWidth, top: 0, bottom: 0 }}
              className={cn(
                'border-r border-slate-100 group',
                isToday && !hasBooking && 'bg-indigo-50/50',
                isWeekend && !isToday && 'bg-slate-50/60',
                !hasBooking && !isAnyDragging && 'hover:bg-indigo-50 cursor-pointer',
              )}
              onClick={(e) => !hasBooking && !isAnyDragging && onCellClick(room.id, colOffset, e.clientX, e.clientY)}
            >
              {!hasBooking && !isAnyDragging && (
                <div className="flex h-full items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <Plus className="h-3 w-3 text-indigo-400" />
                </div>
              )}
            </div>
          )
        })}

        {/* Booking bars */}
        {bookings.map((booking) => {
          const checkInOffset  = differenceInCalendarDays(new Date(booking.checkInDate), startDate)
          const checkOutOffset = differenceInCalendarDays(new Date(booking.checkOutDate), startDate)
          return (
            <BookingBar
              key={booking.id}
              booking={booking}
              checkInOffset={checkInOffset}
              checkOutOffset={checkOutOffset}
              windowSize={windowSize}
              colWidth={colWidth}
              isAnyDragging={isAnyDragging}
              isThisBeingDragged={booking.id === draggingBookingId}
              onClick={onBookingClick}
              onDragStart={onDragStart}
            />
          )
        })}

        {/* Ghost bar */}
        {myGhostBar && (
          <div
            className={cn(
              'pointer-events-none absolute rounded-full border-2 border-dashed',
              myGhostBar.isValid
                ? 'bg-indigo-200/50 border-indigo-400'
                : 'bg-red-200/50 border-red-400'
            )}
            style={{
              left:   Math.max(0, myGhostBar.startCol) * colWidth + 2,
              width:  myGhostBar.nights * colWidth - 4,
              top: 6,
              height: 40,
            }}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Actualizar `BookingBar.tsx`**

```tsx
// src/components/admin/calendar/BookingBar.tsx
import { cn } from '@/lib/utils'
import type { BookingWithRelations } from '@/types'

const STATUS_BG: Record<string, string> = {
  PENDING:    'bg-amber-400 hover:bg-amber-500',
  CONFIRMED:  'bg-emerald-500 hover:bg-emerald-600',
  CHECKED_IN: 'bg-blue-500 hover:bg-blue-600',
  CHECKED_OUT:'bg-slate-400',
  CANCELLED:  'bg-red-400',
}

const SOURCE_BADGE: Record<string, string> = {
  BOOKING: 'B',
  AIRBNB:  'A',
  WEB:     'W',
  MANUAL:  'M',
}

interface BookingBarProps {
  booking: BookingWithRelations
  checkInOffset: number   // 0-indexed from startDate, can be negative
  checkOutOffset: number  // exclusive, can exceed windowSize
  windowSize: number
  colWidth: number
  isAnyDragging: boolean
  isThisBeingDragged: boolean
  onClick: (booking: BookingWithRelations) => void
  onDragStart: (booking: BookingWithRelations, offsetDays: number) => void
}

export function BookingBar({
  booking, checkInOffset, checkOutOffset, windowSize, colWidth,
  isAnyDragging, isThisBeingDragged, onClick, onDragStart,
}: BookingBarProps) {
  const displayStart = Math.max(0, checkInOffset)
  const displayEnd   = Math.min(windowSize, checkOutOffset)
  const displayNights = displayEnd - displayStart
  if (displayNights <= 0) return null

  const canDrag = !['CANCELLED', 'CHECKED_OUT'].includes(booking.status)
  const startsInWindow = checkInOffset >= 0
  const endsInWindow   = checkOutOffset <= windowSize

  function handleDragStart(e: React.DragEvent) {
    if (!canDrag) { e.preventDefault(); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mouseRelX = Math.max(0, e.clientX - rect.left)
    const offsetFromBarStart = Math.floor(mouseRelX / colWidth)
    const clippedDays = Math.max(0, -checkInOffset)
    const offsetDays = clippedDays + offsetFromBarStart
    e.dataTransfer.effectAllowed = 'move'
    onDragStart(booking, offsetDays)
  }

  const badge = SOURCE_BADGE[booking.source] ?? 'M'

  return (
    <div
      draggable={canDrag}
      onDragStart={handleDragStart}
      onClick={() => onClick(booking)}
      style={{
        position: 'absolute',
        left:   displayStart * colWidth + 2,
        width:  displayNights * colWidth - 4,
        top:    6,
        height: 40,
      }}
      className={cn(
        'flex items-center overflow-hidden transition-opacity select-none',
        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        STATUS_BG[booking.status] ?? 'bg-slate-400',
        startsInWindow && endsInWindow  && 'rounded-full',
        startsInWindow && !endsInWindow && 'rounded-l-full',
        !startsInWindow && endsInWindow && 'rounded-r-full',
        isThisBeingDragged && 'opacity-40',
        isAnyDragging && !isThisBeingDragged && 'pointer-events-none',
      )}
    >
      <span className="flex-1 truncate px-3 text-xs font-semibold text-white">
        {booking.guest.firstName}
      </span>
      <span className="mr-2 flex-shrink-0 rounded bg-black/20 px-1 text-[9px] font-bold text-white/90">
        {badge}
      </span>
    </div>
  )
}
```

- [ ] **Step 3: Actualizar `DayHeaders.tsx`**

```tsx
// src/components/admin/calendar/DayHeaders.tsx
import { isSameDay, addDays, format } from 'date-fns'
import { cn } from '@/lib/utils'

const DAYS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

interface DayHeadersProps {
  startDate: Date
  windowSize: number
  today: Date
  colWidth: number
}

export function DayHeaders({ startDate, windowSize, today, colWidth }: DayHeadersProps) {
  return (
    <div className="flex">
      {Array.from({ length: windowSize }, (_, i) => i).map((offset) => {
        const date = addDays(startDate, offset)
        const isToday = isSameDay(date, today)
        const dayOfWeek = (date.getDay() + 6) % 7
        const isWeekend = dayOfWeek >= 5
        const isFirstOfMonth = date.getDate() === 1

        return (
          <div
            key={offset}
            style={{ width: colWidth, minWidth: colWidth }}
            className={cn(
              'flex flex-col items-center justify-center py-1 border-r border-slate-100 select-none',
              isToday
                ? 'bg-indigo-500 text-white'
                : isWeekend
                ? 'bg-slate-50 text-slate-500'
                : 'bg-white text-slate-500'
            )}
          >
            {isFirstOfMonth && (
              <span className="text-[8px] font-bold uppercase opacity-60">
                {format(date, 'MMM')}
              </span>
            )}
            <span className="text-[10px] opacity-70">{DAYS_ES[dayOfWeek]}</span>
            <span className="text-xs font-semibold">{date.getDate()}</span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Actualizar `CalendarGrid.tsx`**

```tsx
// src/components/admin/calendar/CalendarGrid.tsx
import { DayHeaders } from './DayHeaders'
import { RoomRow, type GhostBar } from './RoomRow'
import type { BookingWithRelations } from '@/types'

export const COL_WIDTH = 36
export const ROOM_LABEL_WIDTH = 160

interface CalendarGridProps {
  startDate: Date
  windowSize: number
  rooms: { id: string; name: string }[]
  bookings: BookingWithRelations[]
  today: Date
  draggingBookingId: string | null
  ghostBar: GhostBar | null
  onCellClick: (roomId: string, colOffset: number, clientX: number, clientY: number) => void
  onBookingClick: (booking: BookingWithRelations) => void
  onDragStart: (booking: BookingWithRelations, offsetDays: number) => void
  onDragOver: (e: React.DragEvent, roomId: string, colOffset: number) => void
  onDrop: (e: React.DragEvent, roomId: string, colOffset: number) => void
  onDragEnd: () => void
}

export function CalendarGrid({
  startDate, windowSize, rooms, bookings, today,
  draggingBookingId, ghostBar,
  onCellClick, onBookingClick, onDragStart, onDragOver, onDrop, onDragEnd,
}: CalendarGridProps) {
  const totalWidth = ROOM_LABEL_WIDTH + windowSize * COL_WIDTH

  return (
    <div className="overflow-x-auto" onDragEnd={onDragEnd}>
      <div style={{ minWidth: totalWidth }}>
        <div className="sticky top-0 z-20 flex border-b border-slate-100 bg-white">
          <div
            className="sticky left-0 z-30 flex flex-none items-end bg-slate-50 border-r border-slate-100 px-4 pb-2"
            style={{ width: ROOM_LABEL_WIDTH, minWidth: ROOM_LABEL_WIDTH }}
          >
            <span className="text-xs font-semibold text-slate-500">Habitación</span>
          </div>
          <DayHeaders
            startDate={startDate}
            windowSize={windowSize}
            today={today}
            colWidth={COL_WIDTH}
          />
        </div>
        <div className="divide-y divide-slate-100">
          {rooms.map((room) => (
            <RoomRow
              key={room.id}
              room={room}
              bookings={bookings.filter((b) => b.roomId === room.id)}
              startDate={startDate}
              windowSize={windowSize}
              colWidth={COL_WIDTH}
              roomLabelWidth={ROOM_LABEL_WIDTH}
              today={today}
              draggingBookingId={draggingBookingId}
              ghostBar={ghostBar}
              onCellClick={onCellClick}
              onBookingClick={onBookingClick}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Actualizar `CalendarHeader.tsx`**

```tsx
// src/components/admin/calendar/CalendarHeader.tsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getMonth, getYear, getDaysInMonth } from 'date-fns'

const STATUS_LEGEND = [
  { key: 'PENDING',    label: 'Pendiente',  color: 'bg-amber-400'  },
  { key: 'CONFIRMED',  label: 'Confirmada', color: 'bg-emerald-500' },
  { key: 'CHECKED_IN', label: 'En casa',    color: 'bg-blue-500'   },
  { key: 'CHECKED_OUT',label: 'Finalizada', color: 'bg-slate-400'  },
] as const

const MONTHS_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const YEARS = Array.from({ length: 6 }, (_, i) => 2024 + i)

interface CalendarHeaderProps {
  startDate: Date
  onPrevDay: () => void
  onNextDay: () => void
  onToday: () => void
  onMonthYearChange: (year: number, month: number) => void
}

export function CalendarHeader({
  startDate, onPrevDay, onNextDay, onToday, onMonthYearChange,
}: CalendarHeaderProps) {
  const currentMonth = getMonth(startDate)
  const currentYear  = getYear(startDate)

  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3">
      <div className="flex items-center gap-2">
        <select
          value={currentMonth}
          onChange={(e) => onMonthYearChange(currentYear, Number(e.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {MONTHS_ES.map((name, idx) => (
            <option key={idx} value={idx}>{name}</option>
          ))}
        </select>
        <select
          value={currentYear}
          onChange={(e) => onMonthYearChange(Number(e.target.value), currentMonth)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <span className="ml-1 text-xs text-slate-400">
          ({getDaysInMonth(startDate)} días)
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-3 sm:flex">
          {STATUS_LEGEND.map(({ key, label, color }) => (
            <span key={key} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
              {label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1 border-l border-slate-200 pl-4">
          <button
            onClick={onPrevDay}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
            title="Día anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={onToday}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={onNextDay}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
            title="Día siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Actualizar `HotelCalendar.tsx`**

```tsx
// src/components/admin/HotelCalendar.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { getDaysInMonth, differenceInCalendarDays, addDays } from 'date-fns'
import { CalendarHeader } from './calendar/CalendarHeader'
import { CalendarGrid } from './calendar/CalendarGrid'
import { BookingSlideOver } from './calendar/BookingSlideOver'
import { Toast, type ToastData } from '@/components/ui/Toast'
import { NewBookingModal } from './NewBookingModal'
import type { BookingWithRelations } from '@/types'
import type { GhostBar } from './calendar/RoomRow'

interface Room { id: string; name: string }

interface DragState {
  bookingId: string
  offsetDays: number
}

interface CellMenu {
  roomId: string
  colOffset: number
  x: number
  y: number
}

export function HotelCalendar() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [rooms, setRooms] = useState<Room[]>([])
  const [bookings, setBookings] = useState<BookingWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBooking, setSelectedBooking] = useState<BookingWithRelations | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [ghostBar, setGhostBar] = useState<GhostBar | null>(null)
  const [toasts, setToasts] = useState<ToastData[]>([])
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDefaults, setModalDefaults] = useState<{ roomId?: string; checkIn?: string; checkOut?: string }>({})
  const [cellMenu, setCellMenu] = useState<CellMenu | null>(null)

  const windowSize = getDaysInMonth(startDate)
  const today = new Date()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const from = startDate.toISOString()
      const to   = addDays(startDate, windowSize).toISOString()
      const [r, b] = await Promise.all([
        fetch('/api/rooms').then((res) => res.json()),
        fetch(`/api/bookings?from=${from}&to=${to}`).then((res) => res.json()),
      ])
      setRooms(r)
      setBookings(b)
    } finally {
      setLoading(false)
    }
  }, [startDate, windowSize])

  useEffect(() => { load() }, [load])

  // Close cell menu on outside click
  useEffect(() => {
    if (!cellMenu) return
    function handler() { setCellMenu(null) }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [cellMenu])

  function addToast(type: 'success' | 'error', message: string) {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, type, message }])
  }
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const handleSlideOverClose = useCallback(() => setSelectedBooking(null), [])

  function handleDragStart(booking: BookingWithRelations, offsetDays: number) {
    setDragState({ bookingId: booking.id, offsetDays })
  }

  function handleDragOver(e: React.DragEvent, roomId: string, colOffset: number) {
    if (!dragState) return
    const booking = bookings.find((b) => b.id === dragState.bookingId)
    if (!booking) return

    const newCheckIn  = addDays(startDate, colOffset - dragState.offsetDays)
    const nights      = differenceInCalendarDays(new Date(booking.checkOutDate), new Date(booking.checkInDate))
    const newCheckOut = addDays(newCheckIn, nights)
    const startCol    = differenceInCalendarDays(newCheckIn, startDate)

    const conflict = bookings.some(
      (b) =>
        b.id !== dragState.bookingId &&
        b.roomId === roomId &&
        !['CANCELLED', 'CHECKED_OUT'].includes(b.status) &&
        new Date(b.checkInDate) < newCheckOut &&
        new Date(b.checkOutDate) > newCheckIn
    )

    setGhostBar({ roomId, startCol, nights, isValid: !conflict })
  }

  function handleDrop(e: React.DragEvent, roomId: string, colOffset: number) {
    e.preventDefault()
    if (!dragState || !ghostBar || !ghostBar.isValid) return

    const booking = bookings.find((b) => b.id === dragState.bookingId)
    if (!booking) return

    const newCheckIn  = addDays(startDate, colOffset - dragState.offsetDays)
    const nights      = differenceInCalendarDays(new Date(booking.checkOutDate), new Date(booking.checkInDate))
    const newCheckOut = addDays(newCheckIn, nights)
    const previousBookings = bookings

    const targetRoom = rooms.find((r) => r.id === roomId)
    const updated = bookings.map((b): BookingWithRelations => {
      if (b.id !== booking.id) return b
      return {
        ...b,
        checkInDate:  newCheckIn.toISOString() as unknown as Date,
        checkOutDate: newCheckOut.toISOString() as unknown as Date,
        roomId,
        room: targetRoom ? { ...b.room, id: roomId, name: targetRoom.name } : b.room,
      }
    })
    setBookings(updated)
    setDragState(null)
    setGhostBar(null)

    ;(async () => {
      try {
        const res = await fetch(`/api/bookings/${booking.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkInDate:  newCheckIn.toISOString(),
            checkOutDate: newCheckOut.toISOString(),
            roomId,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error ?? 'Error al mover la reserva')
        }
        addToast('success', 'Reserva movida correctamente')
        await load()
      } catch (err) {
        setBookings(previousBookings)
        addToast('error', err instanceof Error ? err.message : 'Error al mover la reserva')
      }
    })()
  }

  function handleDragEnd() {
    setDragState(null)
    setGhostBar(null)
  }

  async function handleStatusChange(id: string, status: string) {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Error al actualizar estado')
      setSelectedBooking(null)
      await load()
      addToast('success', 'Estado actualizado')
    } catch {
      addToast('error', 'Error al actualizar el estado')
    } finally {
      setUpdatingId(null)
    }
  }

  function handleCellClick(roomId: string, colOffset: number, clientX: number, clientY: number) {
    setCellMenu({ roomId, colOffset, x: clientX, y: clientY })
  }

  function openNewBooking() {
    if (!cellMenu) return
    const checkIn  = addDays(startDate, cellMenu.colOffset).toISOString().split('T')[0]
    const checkOut = addDays(startDate, cellMenu.colOffset + 1).toISOString().split('T')[0]
    setModalDefaults({ roomId: cellMenu.roomId, checkIn, checkOut })
    setModalOpen(true)
    setCellMenu(null)
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <CalendarHeader
          startDate={startDate}
          onPrevDay={() => setStartDate((d) => addDays(d, -1))}
          onNextDay={() => setStartDate((d) => addDays(d, 1))}
          onToday={() => {
            const d = new Date()
            d.setHours(0, 0, 0, 0)
            setStartDate(d)
          }}
          onMonthYearChange={(year, month) => setStartDate(new Date(year, month, 1))}
        />

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : (
          <CalendarGrid
            startDate={startDate}
            windowSize={windowSize}
            rooms={rooms}
            bookings={bookings}
            today={today}
            draggingBookingId={dragState?.bookingId ?? null}
            ghostBar={ghostBar}
            onCellClick={handleCellClick}
            onBookingClick={setSelectedBooking}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        )}
      </div>

      {/* Cell action menu */}
      {cellMenu && (
        <div
          className="fixed z-50 rounded-xl border border-slate-200 bg-white shadow-xl py-1 min-w-[160px]"
          style={{ top: cellMenu.y + 8, left: cellMenu.x - 80 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={openNewBooking}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Nueva reserva
          </button>
          <button
            onClick={() => {
              // Placeholder: BlockDatesModal opens here in Task 8
              setCellMenu(null)
            }}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Bloquear fechas
          </button>
        </div>
      )}

      <BookingSlideOver
        booking={selectedBooking}
        onClose={handleSlideOverClose}
        onStatusChange={handleStatusChange}
        updatingId={updatingId}
      />

      <NewBookingModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); load() }}
        defaultRoomId={modalDefaults.roomId}
        defaultCheckIn={modalDefaults.checkIn}
        defaultCheckOut={modalDefaults.checkOut}
      />

      <Toast toasts={toasts} onRemove={removeToast} />
    </>
  )
}
```

- [ ] **Step 7: Verificar compilación**

```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/HotelCalendar.tsx src/components/admin/calendar/
git commit -m "feat: refactor calendar to sliding window with startDate, add month/year picker and day navigation"
```

---

## Task 3: Modelo DB AvailabilityBlock

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: tipo `AvailabilityBlock` disponible desde `@/db/client` y re-exportado desde `@/types`

- [ ] **Step 1: Añadir modelo en `schema.prisma`**

Añadir al final del archivo `prisma/schema.prisma`, antes del EOF:

```prisma
model AvailabilityBlock {
  id         String   @id @default(cuid())
  roomId     String
  startDate  DateTime
  endDate    DateTime
  platforms  String[]
  reason     String?
  externalId String?  @unique
  source     String   @default("manual")
  room       Room     @relation(fields: [roomId], references: [id])
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

También añadir la relación inversa en el modelo `Room`, dentro del bloque `Room` existente, después de `icalFeeds ICalFeed[]`:

```prisma
  availabilityBlocks AvailabilityBlock[]
```

- [ ] **Step 2: Ejecutar migración**

```bash
npx prisma migrate dev --name add_availability_blocks
```

Expected: migración creada y aplicada, cliente regenerado.

- [ ] **Step 3: Añadir tipo a `src/types/index.ts`**

Añadir en `src/types/index.ts`, junto a los imports existentes:

```ts
import type { AvailabilityBlock } from '@/db/client'
export type { AvailabilityBlock }
```

- [ ] **Step 4: Verificar compilación**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add prisma/ src/types/index.ts
git commit -m "feat: add AvailabilityBlock model for per-platform date blocking"
```

---

## Task 4: Fix iCal sync — eventos CLOSED → AvailabilityBlock

Actualmente `syncIcalFeed` en `src/lib/ical.ts` crea un `Guest` + `Booking` para todos los eventos, incluyendo los de fechas cerradas de Booking.com ("CLOSED - Not available"). Este task detecta esos eventos y crea `AvailabilityBlock` en su lugar.

**Files:**
- Modify: `src/lib/ical.ts`

**Interfaces:**
- Consumes: `AvailabilityBlock` model en Prisma
- Produces: eventos CLOSED → `prisma.availabilityBlock.upsert`

- [ ] **Step 1: Añadir función `isBlockedEvent` y actualizar `syncIcalFeed`**

En `src/lib/ical.ts`, añadir después de la función `extractGuestName` (línea 97):

```ts
const BLOCKED_SUMMARIES = ['closed', 'not available', 'not_available', 'blocked', 'unavailable']

function isBlockedEvent(event: ICalEvent): boolean {
  const summary = (event.summary ?? '').toLowerCase()
  const desc    = (event.description ?? '').toLowerCase()
  return BLOCKED_SUMMARIES.some((k) => summary.includes(k) || desc.includes(k))
}
```

Luego, dentro de `syncIcalFeed`, reemplazar el bloque que empieza en `// Skip if already imported` hasta el `stats.created++` por:

```ts
    // Handle blocked/closed events (e.g. Booking.com "CLOSED - Not available")
    if (isBlockedEvent(event)) {
      const existingBlock = await prisma.availabilityBlock.findUnique({ where: { externalId } })
      if (!existingBlock) {
        await prisma.availabilityBlock.create({
          data: {
            roomId,
            startDate: event.start,
            endDate:   event.end,
            platforms: [platform],
            reason:    event.summary ?? 'CLOSED',
            externalId,
            source:    'ical_sync',
          },
        })
        stats.created++
      } else {
        stats.skipped++
      }
      continue
    }

    // Skip if already imported as booking
    const exists = await prisma.booking.findUnique({ where: { externalId } })
    if (exists) { stats.skipped++; continue }

    // Skip past events (ended more than 1 day ago)
    if (event.end < new Date(Date.now() - 86400000)) { stats.skipped++; continue }

    // Check for overbooking conflict
    const conflict = await prisma.booking.findFirst({
      where: {
        roomId,
        status: { notIn: ['CANCELLED'] },
        AND: [{ checkInDate: { lt: event.end } }, { checkOutDate: { gt: event.start } }],
      },
    })
    if (conflict) {
      console.warn(`[iCal] Overbooking conflict for ${externalId}`)
      stats.skipped++
      continue
    }

    // Create a placeholder guest
    const { firstName, lastName } = extractGuestName(event)
    const documentId = `ICAL-${platform.toUpperCase()}-${event.uid.slice(-12)}`

    const guest = await prisma.guest.upsert({
      where: { documentId },
      update: {},
      create: {
        firstName, lastName, documentId,
        email: `${documentId.toLowerCase()}@ical.noreply`,
      },
    })

    const nights = Math.max(1, Math.ceil((event.end.getTime() - event.start.getTime()) / 86400000))
    const room = await prisma.room.findUnique({ where: { id: roomId } })
    const totalAmount = room ? Number(room.basePrice) * nights : 0

    const sourceMap: Record<string, 'BOOKING' | 'AIRBNB' | 'MANUAL'> = {
      booking_com: 'BOOKING', airbnb: 'AIRBNB',
    }

    await prisma.booking.create({
      data: {
        guestId: guest.id, roomId,
        checkInDate: event.start, checkOutDate: event.end,
        totalAmount, status: 'CONFIRMED',
        source: sourceMap[platform] ?? 'MANUAL',
        externalId,
        notes: `iCal sync · ${platform} · ${event.uid}`,
      },
    })
    stats.created++
```

- [ ] **Step 2: Verificar compilación**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/ical.ts
git commit -m "fix: detect CLOSED ical events and create AvailabilityBlock instead of fake booking"
```

---

## Task 5: API de bloques de disponibilidad

**Files:**
- Create: `src/app/api/availability-blocks/route.ts`
- Create: `src/app/api/availability-blocks/[id]/route.ts`
- Modify: `src/app/api/ical-feeds/route.ts` (añadir filtro ?roomId=)

**Interfaces:**
- `GET /api/availability-blocks?from=&to=&roomId=` → `AvailabilityBlock[]`
- `POST /api/availability-blocks` body: `{ roomId, startDate, endDate, platforms, reason? }` → `AvailabilityBlock`
- `DELETE /api/availability-blocks/[id]` → `{ success: true }`

- [ ] **Step 1: Crear `src/app/api/availability-blocks/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const from   = searchParams.get('from')
  const to     = searchParams.get('to')
  const roomId = searchParams.get('roomId')

  const blocks = await prisma.availabilityBlock.findMany({
    where: {
      ...(roomId && { roomId }),
      ...(from && to && {
        startDate: { lt: new Date(to) },
        endDate:   { gt: new Date(from) },
      }),
    },
    orderBy: { startDate: 'asc' },
  })
  return NextResponse.json(blocks)
}

export async function POST(req: NextRequest) {
  const { roomId, startDate, endDate, platforms, reason } = await req.json()

  if (!roomId || !startDate || !endDate || !platforms?.length) {
    return NextResponse.json(
      { error: 'roomId, startDate, endDate y platforms son obligatorios' },
      { status: 400 }
    )
  }

  const block = await prisma.availabilityBlock.create({
    data: {
      roomId,
      startDate: new Date(startDate),
      endDate:   new Date(endDate),
      platforms,
      reason:    reason ?? null,
      source:    'manual',
    },
  })
  return NextResponse.json(block, { status: 201 })
}
```

- [ ] **Step 2: Crear `src/app/api/availability-blocks/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.availabilityBlock.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Añadir filtro `?roomId=` a `/api/ical-feeds/route.ts`**

Reemplazar la función `GET` en `src/app/api/ical-feeds/route.ts`:

```ts
export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('roomId')
  const feeds = await prisma.iCalFeed.findMany({
    where: roomId ? { roomId } : undefined,
    include: { room: true },
    orderBy: [{ room: { name: 'asc' } }, { platform: 'asc' }],
  })
  return NextResponse.json(feeds)
}
```

Cambiar también la firma de la función exportada de `GET()` a `GET(req: NextRequest)`.

- [ ] **Step 4: Verificar compilación**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/availability-blocks/ src/app/api/ical-feeds/route.ts
git commit -m "feat: add availability blocks API and roomId filter on ical-feeds"
```

---

## Task 6: iCal export — incluir bloques con filtro de plataforma

**Files:**
- Modify: `src/lib/ical.ts`
- Modify: `src/app/api/ical/[roomId]/route.ts`

**Interfaces:**
- `generateIcalExport` añade parámetro `blocks: Array<{ id: string; startDate: Date; endDate: Date }>`
- `GET /api/ical/[roomId]?platform=booking_com` filtra bloques por plataforma

- [ ] **Step 1: Actualizar `generateIcalExport` en `src/lib/ical.ts`**

Reemplazar la función `generateIcalExport` al final de `src/lib/ical.ts`:

```ts
/** Generate iCal export of our bookings + manual blocks for a room */
export function generateIcalExport(
  bookings: Array<{ externalId: string | null; checkInDate: Date; checkOutDate: Date; guest: { firstName: string; lastName: string } }>,
  blocks: Array<{ id: string; startDate: Date; endDate: Date }>,
  roomName: string
): string {
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'

  const bookingEvents = bookings
    .filter((b) => b.checkOutDate > new Date())
    .map((b) => {
      const uid = b.externalId ?? `pms-${b.checkInDate.getTime()}`
      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        `DTSTART:${fmt(b.checkInDate)}`,
        `DTEND:${fmt(b.checkOutDate)}`,
        `SUMMARY:BLOCKED - ${b.guest.firstName} ${b.guest.lastName}`,
        `STATUS:CONFIRMED`,
        'END:VEVENT',
      ].join('\r\n')
    })

  const blockEvents = blocks
    .filter((bl) => bl.endDate > new Date())
    .map((bl) => [
      'BEGIN:VEVENT',
      `UID:block-${bl.id}`,
      `DTSTAMP:${now}`,
      `DTSTART:${fmt(bl.startDate)}`,
      `DTEND:${fmt(bl.endDate)}`,
      `SUMMARY:CLOSED - Not available`,
      `STATUS:CONFIRMED`,
      'END:VEVENT',
    ].join('\r\n'))

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hotel PMS//Casa La Aldea//ES',
    `X-WR-CALNAME:${roomName}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...bookingEvents,
    ...blockEvents,
    'END:VCALENDAR',
  ].join('\r\n')
}
```

- [ ] **Step 2: Actualizar `src/app/api/ical/[roomId]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateIcalExport } from '@/lib/ical'

export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const platform = req.nextUrl.searchParams.get('platform') ?? undefined

  const [bookings, room, blocks] = await Promise.all([
    prisma.booking.findMany({
      where: {
        roomId,
        status: { notIn: ['CANCELLED'] },
        checkOutDate: { gte: new Date() },
      },
      include: { guest: true },
      orderBy: { checkInDate: 'asc' },
    }),
    prisma.room.findUnique({ where: { id: roomId } }),
    prisma.availabilityBlock.findMany({
      where: {
        roomId,
        endDate: { gte: new Date() },
        ...(platform && {
          platforms: { has: platform },
        }),
      },
    }),
  ])

  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  const ical = generateIcalExport(bookings, blocks, room.name)

  return new NextResponse(ical, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${room.name.replace(/\s+/g, '_')}.ics"`,
      'Cache-Control': 'no-cache',
    },
  })
}
```

Nota: `{ platforms: { has: platform } }` es la sintaxis de Prisma para filtrar arrays que contienen un valor específico en PostgreSQL.

- [ ] **Step 3: Verificar compilación**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ical.ts src/app/api/ical/
git commit -m "feat: include availability blocks in ical export with optional platform filter"
```

---

## Task 7: BlockBar — visualización de bloques en el calendario

**Files:**
- Create: `src/components/admin/calendar/BlockBar.tsx`
- Modify: `src/components/admin/calendar/RoomRow.tsx`
- Modify: `src/components/admin/calendar/CalendarGrid.tsx`
- Modify: `src/components/admin/HotelCalendar.tsx`

**Interfaces:**
- Consumes: `AvailabilityBlock` de `@/types`
- Produces: `BlockBar` — barra delgada de 6px por bloque, anclada al fondo de la fila. Fila aumenta a 68px.

- [ ] **Step 1: Crear `BlockBar.tsx`**

```tsx
// src/components/admin/calendar/BlockBar.tsx
import type { AvailabilityBlock } from '@/types'

const PLATFORM_STYLE: Record<string, { bg: string; label: string }> = {
  booking_com: { bg: '#003580', label: 'Booking.com' },
  airbnb:      { bg: '#FF5A5F', label: 'Airbnb'      },
  web:         { bg: '#9FE870', label: 'Web'          },
}

function getPlatformStyle(platform: string) {
  return PLATFORM_STYLE[platform] ?? { bg: '#94A3B8', label: platform }
}

interface BlockBarProps {
  block: AvailabilityBlock
  startOffset: number   // 0-indexed from startDate (can be negative)
  endOffset: number     // exclusive (can exceed windowSize)
  windowSize: number
  colWidth: number
  stackIndex: number    // 0 = bottom-most, stacks upward
}

export function BlockBar({ block, startOffset, endOffset, windowSize, colWidth, stackIndex }: BlockBarProps) {
  const displayStart  = Math.max(0, startOffset)
  const displayEnd    = Math.min(windowSize, endOffset)
  const displayNights = displayEnd - displayStart
  if (displayNights <= 0) return null

  const BAR_HEIGHT = 6
  const BAR_GAP    = 2
  // Anchor to bottom of row (row height 70px; booking bar ends at y=46 so 3 bars fit without overlap)
  const bottomBase = 70
  const bottom = BAR_GAP + stackIndex * (BAR_HEIGHT + BAR_GAP)
  const top    = bottomBase - bottom - BAR_HEIGHT

  const platforms = block.platforms.length > 0 ? block.platforms : ['manual']
  const style = getPlatformStyle(platforms[0])
  const tooltip = `${platforms.map((p) => getPlatformStyle(p).label).join(', ')}${block.reason ? ` · ${block.reason}` : ''}`

  return (
    <div
      title={tooltip}
      style={{
        position: 'absolute',
        left:     displayStart * colWidth + 1,
        width:    displayNights * colWidth - 2,
        top,
        height:   BAR_HEIGHT,
        background: `repeating-linear-gradient(45deg, ${style.bg}, ${style.bg} 3px, ${style.bg}cc 3px, ${style.bg}cc 6px)`,
        borderRadius: 2,
        opacity: 0.85,
      }}
    />
  )
}
```

- [ ] **Step 2: Actualizar `RoomRow.tsx` para renderizar BlockBar**

Añadir `import` y prop `blocks` a `RoomRow`. Al final del archivo, añadir el import:

```tsx
import { BlockBar } from './BlockBar'
import type { AvailabilityBlock } from '@/types'
```

Añadir `blocks: AvailabilityBlock[]` a la interfaz `RoomRowProps`.

Añadir en el destructuring de props: `blocks`.

Después del bloque de los booking bars y antes del ghost bar, añadir:

```tsx
        {/* Availability block bars */}
        {blocks.map((block, idx) => {
          const startOffset = differenceInCalendarDays(new Date(block.startDate), startDate)
          const endOffset   = differenceInCalendarDays(new Date(block.endDate),   startDate)
          return (
            <BlockBar
              key={block.id}
              block={block}
              startOffset={startOffset}
              endOffset={endOffset}
              windowSize={windowSize}
              colWidth={colWidth}
              stackIndex={idx % 3}
            />
          )
        })}
```

- [ ] **Step 3: Actualizar `CalendarGrid.tsx` para pasar blocks**

Añadir `blocks: AvailabilityBlock[]` a `CalendarGridProps`.

Añadir import: `import type { AvailabilityBlock } from '@/types'`

Pasar `blocks={blocks.filter((bl) => bl.roomId === room.id)}` a cada `<RoomRow>`.

- [ ] **Step 4: Actualizar `HotelCalendar.tsx` para fetchear blocks**

Añadir estado: `const [blocks, setBlocks] = useState<AvailabilityBlock[]>([])`

Añadir import de tipo: `import type { AvailabilityBlock } from '@/types'`

En la función `load`, añadir al Promise.all:

```ts
fetch(`/api/availability-blocks?from=${from}&to=${to}`).then((res) => res.json()),
```

El destructuring pasa de `const [r, b] = ...` a `const [r, b, bl] = ...` y añadir `setBlocks(bl)`.

Pasar `blocks={blocks}` a `<CalendarGrid>`.

- [ ] **Step 5: Verificar compilación**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/calendar/BlockBar.tsx src/components/admin/calendar/RoomRow.tsx src/components/admin/calendar/CalendarGrid.tsx src/components/admin/HotelCalendar.tsx
git commit -m "feat: render availability block bars per platform in calendar rows"
```

---

## Task 8: BlockDatesModal — bloqueo manual desde el calendario

**Files:**
- Create: `src/components/admin/BlockDatesModal.tsx`
- Modify: `src/components/admin/HotelCalendar.tsx`

**Interfaces:**
- Consumes: `/api/ical-feeds?roomId=`, `/api/availability-blocks` (POST)
- `BlockDatesModal` props: `open`, `roomId`, `defaultStart`, `defaultEnd`, `onClose`, `onCreated`

- [ ] **Step 1: Crear `BlockDatesModal.tsx`**

```tsx
// src/components/admin/BlockDatesModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { format, addDays } from 'date-fns'

const PLATFORM_LABELS: Record<string, string> = {
  booking_com: 'Booking.com',
  airbnb:      'Airbnb',
  web:         'Web (propia)',
}

interface Feed { id: string; platform: string }

interface BlockDatesModalProps {
  open: boolean
  roomId: string | null
  defaultStart: string   // YYYY-MM-DD
  defaultEnd: string     // YYYY-MM-DD
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
          endDate:   addDays(new Date(endDate), 1).toISOString(), // endDate exclusivo
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
```

- [ ] **Step 2: Integrar `BlockDatesModal` en `HotelCalendar.tsx`**

Añadir import:
```tsx
import { BlockDatesModal } from './BlockDatesModal'
```

Añadir estado:
```tsx
const [blockModalOpen, setBlockModalOpen] = useState(false)
```

Reemplazar el `onClick` del botón "Bloquear fechas" en el cell menu por:
```tsx
onClick={() => {
  setBlockModalOpen(true)
  setCellMenu(null)
}}
```

Antes del cierre del fragmento `<>`, añadir:
```tsx
<BlockDatesModal
  open={blockModalOpen}
  roomId={cellMenu?.roomId ?? modalDefaults.roomId ?? null}
  defaultStart={cellMenu ? addDays(startDate, cellMenu.colOffset).toISOString().split('T')[0] : ''}
  defaultEnd={cellMenu ? addDays(startDate, cellMenu.colOffset).toISOString().split('T')[0] : ''}
  onClose={() => setBlockModalOpen(false)}
  onCreated={() => { load(); addToast('success', 'Fechas bloqueadas') }}
/>
```

Nota: `cellMenu` se limpia al abrir el modal, por lo que hay que guardar la info antes de limpiar. Para ello, usar un ref o guardar el `pendingCell` en estado adicional. Reemplazar el `onClick` del botón "Bloquear fechas" por:

```tsx
onClick={() => {
  if (!cellMenu) return
  setModalDefaults({ roomId: cellMenu.roomId })
  const dateStr = addDays(startDate, cellMenu.colOffset).toISOString().split('T')[0]
  setBlockDatesDefaults({ start: dateStr, end: dateStr })
  setBlockModalOpen(true)
  setCellMenu(null)
}}
```

Y añadir estado:
```tsx
const [blockDatesDefaults, setBlockDatesDefaults] = useState({ start: '', end: '' })
```

Actualizar el modal:
```tsx
<BlockDatesModal
  open={blockModalOpen}
  roomId={modalDefaults.roomId ?? null}
  defaultStart={blockDatesDefaults.start}
  defaultEnd={blockDatesDefaults.end}
  onClose={() => setBlockModalOpen(false)}
  onCreated={() => { load(); addToast('success', 'Fechas bloqueadas') }}
/>
```

- [ ] **Step 3: Verificar compilación**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verificar en dev server**

```bash
npm run dev
```

Comprobar:
1. Sidebar se colapsa/expande con el botón, estado persiste al recargar.
2. Flechas del calendario avanzan/retroceden 1 día; el selector de mes/año salta al mes correcto.
3. Al arrastrar una reserva cerca de fin de mes, la vista muestra el siguiente mes en la misma ventana.
4. Al clicar en una celda vacía aparece el mini-menú con "Nueva reserva" y "Bloquear fechas".
5. "Bloquear fechas" abre el modal con las fechas y plataformas disponibles.
6. Al guardar un bloqueo, aparece la barra delgada de color en la fila de la habitación.

- [ ] **Step 5: Commit final**

```bash
git add src/components/admin/BlockDatesModal.tsx src/components/admin/HotelCalendar.tsx
git commit -m "feat: add BlockDatesModal for manual per-platform date blocking from calendar"
```
