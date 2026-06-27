# Calendario Gantt — Plan de Implementación

> **Para agentes:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea por tarea. Los steps usan sintaxis checkbox (`- [ ]`) para tracking.

**Goal:** Reemplazar el calendario de tabla básica por un Gantt profesional con barras continuas, drag & drop de reservas (fechas + habitación simultáneamente) y panel lateral deslizante de detalle.

**Architecture:** Un componente orquestador `HotelCalendar.tsx` gestiona datos, estado de drag y toasts. Subcomponentes presentacionales bajo `src/components/admin/calendar/` manejan render e interacciones. La API PUT de bookings se extiende primero para aceptar `roomId`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, HTML5 Drag & Drop API nativa, date-fns v4, Prisma 7. Sin dependencias npm nuevas.

## Global Constraints

- `COL_WIDTH = 36` px por columna de día; `ROW_HEIGHT = 52` px por fila de habitación; `ROOM_LABEL_WIDTH = 160` px
- Barras: pill shape (`rounded-full`), coloreadas por status con la paleta `STATUS_BG` definida en `BookingBar.tsx`
- Solo el nombre del huésped en la barra; texto truncado con `truncate`
- Drag deshabilitado (`draggable={false}`) para status `CANCELLED` y `CHECKED_OUT`
- Las barras no-dragged tienen `pointer-events-none` durante un drag activo para que `dragover` llegue al contenedor
- Actualización optimista en drop; rollback si la API devuelve error
- No añadir dependencias npm

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `src/app/api/bookings/[id]/route.ts` | Modificar | Aceptar `roomId` en PUT + anti-overbooking + Channex para cambio de habitación |
| `src/components/ui/Toast.tsx` | Crear | Notificaciones éxito/error con auto-dismiss |
| `src/components/admin/calendar/CalendarHeader.tsx` | Crear | Toolbar: navegación mes, leyenda de estados, botón Hoy |
| `src/components/admin/calendar/DayHeaders.tsx` | Crear | Fila de cabecera con números de día, letra de día, resaltado hoy/finde |
| `src/components/admin/calendar/BookingBar.tsx` | Crear | Barra draggable de una reserva, posicionamiento absoluto |
| `src/components/admin/calendar/BookingSlideOver.tsx` | Crear | Panel lateral deslizante con detalle completo y acciones |
| `src/components/admin/calendar/RoomRow.tsx` | Crear | Fila de habitación: drop zone + barras + celdas de día |
| `src/components/admin/calendar/CalendarGrid.tsx` | Crear | Ensambla DayHeaders + RoomRows con sticky headers |
| `src/components/admin/HotelCalendar.tsx` | Reescribir | Orquestador: fetch, drag state, optimistic updates, modals |

---

### Task 1: Extender `PUT /api/bookings/[id]` para aceptar `roomId`

**Files:**
- Modify: `src/app/api/bookings/[id]/route.ts`

**Interfaces:**
- Produces: `PUT /api/bookings/[id]` acepta opcionalmente `{ roomId: string }` además de los campos existentes. Devuelve `409 { error: 'La habitación ya está ocupada en esas fechas' }` si hay conflicto. Actualiza disponibilidad en Channex para la habitación antigua y nueva si corresponde.

- [ ] **Step 1: Reemplazar la función `PUT` completa**

Sustituir todo el bloque `export async function PUT(...)` en `src/app/api/bookings/[id]/route.ts` por:

```ts
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()
    const { status, depositPaid, notes, checkInDate, checkOutDate, roomId } = body

    const before = await prisma.booking.findUnique({ where: { id }, include: { room: true } })
    if (!before) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    // Anti-overbooking: validar si cambian habitación o fechas
    if (roomId !== undefined || checkInDate !== undefined || checkOutDate !== undefined) {
      const targetRoomId = roomId ?? before.roomId
      const targetCheckIn = checkInDate ? new Date(checkInDate) : before.checkInDate
      const targetCheckOut = checkOutDate ? new Date(checkOutDate) : before.checkOutDate

      const conflict = await prisma.booking.findFirst({
        where: {
          id: { not: id },
          roomId: targetRoomId,
          status: { notIn: ['CANCELLED', 'CHECKED_OUT'] },
          checkInDate: { lt: targetCheckOut },
          checkOutDate: { gt: targetCheckIn },
        },
      })
      if (conflict) {
        return NextResponse.json(
          { error: 'La habitación ya está ocupada en esas fechas' },
          { status: 409 }
        )
      }
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        ...(status !== undefined && { status: status as BookingStatus }),
        ...(depositPaid !== undefined && { depositPaid: Boolean(depositPaid) }),
        ...(notes !== undefined && { notes }),
        ...(checkInDate !== undefined && { checkInDate: new Date(checkInDate) }),
        ...(checkOutDate !== undefined && { checkOutDate: new Date(checkOutDate) }),
        ...(roomId !== undefined && { roomId }),
      },
      include: { guest: true, room: true },
    })

    // Channex: sincronizar disponibilidad
    const becomingCancelled = status === 'CANCELLED' && before.status !== 'CANCELLED'
    const roomChanged = roomId !== undefined && roomId !== before.roomId
    const datesOrRoomChanged = roomChanged || checkInDate !== undefined || checkOutDate !== undefined

    if (becomingCancelled) {
      if (before.room.channexRoomTypeId) {
        pushAvailability(before.room.channexRoomTypeId, before.checkInDate, before.checkOutDate, 1).catch(console.error)
      }
    } else if (datesOrRoomChanged && before.status !== 'CANCELLED') {
      const newCheckIn = checkInDate ? new Date(checkInDate) : before.checkInDate
      const newCheckOut = checkOutDate ? new Date(checkOutDate) : before.checkOutDate
      // Abrir slot antiguo
      if (before.room.channexRoomTypeId) {
        pushAvailability(before.room.channexRoomTypeId, before.checkInDate, before.checkOutDate, 1).catch(console.error)
      }
      if (roomChanged) {
        // Bloquear slot en habitación nueva
        const newRoom = await prisma.room.findUnique({ where: { id: roomId } })
        if (newRoom?.channexRoomTypeId) {
          pushAvailability(newRoom.channexRoomTypeId, newCheckIn, newCheckOut, 0).catch(console.error)
        }
      } else if (before.room.channexRoomTypeId) {
        // Misma habitación, fechas cambiadas — bloquear nuevas fechas
        pushAvailability(before.room.channexRoomTypeId, newCheckIn, newCheckOut, 0).catch(console.error)
      }
    }

    return NextResponse.json(booking)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar reserva' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verificar en navegador**

Con `npm run dev` corriendo, abrir DevTools → Console y ejecutar (reemplazar con IDs reales de la BD):

```js
// Caso 1: cambio de habitación sin conflicto — espera 200
const r1 = await fetch('/api/bookings/ID_RESERVA', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ roomId: 'ID_HABITACION_LIBRE' })
})
console.log(r1.status, await r1.json())

// Caso 2: cambio a habitación ocupada — espera 409
const r2 = await fetch('/api/bookings/ID_RESERVA', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ roomId: 'ID_HABITACION_OCUPADA' })
})
console.log(r2.status, await r2.json()) // { error: 'La habitación ya está ocupada en esas fechas' }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bookings/[id]/route.ts
git commit -m "feat: extend PUT /bookings/:id to accept roomId with anti-overbooking and Channex sync"
```

---

### Task 2: Componente `Toast`

**Files:**
- Create: `src/components/ui/Toast.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface ToastData { id: string; type: 'success' | 'error'; message: string }
  export function Toast({ toasts, onRemove }: { toasts: ToastData[]; onRemove: (id: string) => void }): JSX.Element
  ```

- [ ] **Step 1: Crear `src/components/ui/Toast.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ToastData {
  id: string
  type: 'success' | 'error'
  message: string
}

export function Toast({ toasts, onRemove }: { toasts: ToastData[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: ToastData; onRemove: (id: string) => void }) {
  useEffect(() => {
    const ms = toast.type === 'error' ? 5000 : 3000
    const timer = setTimeout(() => onRemove(toast.id), ms)
    return () => clearTimeout(timer)
  }, [toast.id, toast.type, onRemove])

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg',
        toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
      )}
    >
      {toast.type === 'success'
        ? <Check className="h-4 w-4 shrink-0" />
        : <X className="h-4 w-4 shrink-0" />
      }
      {toast.message}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/Toast.tsx
git commit -m "feat: add Toast notification component"
```

---

### Task 3: `CalendarHeader`

**Files:**
- Create: `src/components/admin/calendar/CalendarHeader.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function CalendarHeader(props: {
    currentDate: Date
    onPrevMonth: () => void
    onNextMonth: () => void
    onToday: () => void
  }): JSX.Element
  ```

- [ ] **Step 1: Crear directorio y archivo**

```bash
mkdir -p src/components/admin/calendar
```

Crear `src/components/admin/calendar/CalendarHeader.tsx`:

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

const STATUS_LEGEND = [
  { key: 'PENDING',    label: 'Pendiente',  color: 'bg-amber-400'  },
  { key: 'CONFIRMED',  label: 'Confirmada', color: 'bg-emerald-500' },
  { key: 'CHECKED_IN', label: 'En casa',    color: 'bg-blue-500'   },
  { key: 'CHECKED_OUT',label: 'Finalizada', color: 'bg-slate-400'  },
] as const

interface CalendarHeaderProps {
  currentDate: Date
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
}

export function CalendarHeader({ currentDate, onPrevMonth, onNextMonth, onToday }: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3">
      <h2 className="text-sm font-bold capitalize text-slate-800">
        {format(currentDate, 'MMMM yyyy')}
      </h2>
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
            onClick={onPrevMonth}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
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
            onClick={onNextMonth}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/calendar/CalendarHeader.tsx
git commit -m "feat: add CalendarHeader component"
```

---

### Task 4: `DayHeaders`

**Files:**
- Create: `src/components/admin/calendar/DayHeaders.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function DayHeaders(props: {
    year: number
    month: number        // 0-indexed
    daysInMonth: number
    today: Date
    colWidth: number
  }): JSX.Element
  ```

- [ ] **Step 1: Crear `src/components/admin/calendar/DayHeaders.tsx`**

```tsx
import { isSameDay } from 'date-fns'
import { cn } from '@/lib/utils'

const DAYS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] // Lun–Dom

interface DayHeadersProps {
  year: number
  month: number
  daysInMonth: number
  today: Date
  colWidth: number
}

export function DayHeaders({ year, month, daysInMonth, today, colWidth }: DayHeadersProps) {
  return (
    <div className="flex">
      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
        const date = new Date(year, month, day)
        const isToday = isSameDay(date, today)
        const dayOfWeek = (date.getDay() + 6) % 7 // 0=Lun, 6=Dom
        const isWeekend = dayOfWeek >= 5

        return (
          <div
            key={day}
            style={{ width: colWidth, minWidth: colWidth }}
            className={cn(
              'flex flex-col items-center justify-center py-2 border-r border-slate-100 select-none',
              isToday
                ? 'bg-indigo-500 text-white'
                : isWeekend
                ? 'bg-slate-50 text-slate-500'
                : 'bg-white text-slate-500'
            )}
          >
            <span className="text-[10px] opacity-70">{DAYS_ES[dayOfWeek]}</span>
            <span className="text-xs font-semibold">{day}</span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/calendar/DayHeaders.tsx
git commit -m "feat: add DayHeaders component"
```

---

### Task 5: `BookingBar`

**Files:**
- Create: `src/components/admin/calendar/BookingBar.tsx`

**Interfaces:**
- Consumes: `BookingWithRelations` de `@/types`
- Produces:
  ```ts
  export const STATUS_BG: Record<string, string>
  export function BookingBar(props: {
    booking: BookingWithRelations
    checkInDay: number      // 1-indexed día en el mes actual; puede ser ≤ 0 si empieza antes
    checkOutDay: number     // exclusivo; puede ser > daysInMonth + 1 si termina después
    daysInMonth: number
    colWidth: number
    isAnyDragging: boolean  // true cuando cualquier drag está activo
    isThisBeingDragged: boolean
    onClick: (booking: BookingWithRelations) => void
    onDragStart: (booking: BookingWithRelations, offsetDays: number) => void
  }): JSX.Element | null
  ```

- [ ] **Step 1: Crear `src/components/admin/calendar/BookingBar.tsx`**

```tsx
import { cn } from '@/lib/utils'
import type { BookingWithRelations } from '@/types'

export const STATUS_BG: Record<string, string> = {
  PENDING:    'bg-amber-400 hover:bg-amber-500',
  CONFIRMED:  'bg-emerald-500 hover:bg-emerald-600',
  CHECKED_IN: 'bg-blue-500 hover:bg-blue-600',
  CHECKED_OUT:'bg-slate-400',
  CANCELLED:  'bg-red-400',
}

interface BookingBarProps {
  booking: BookingWithRelations
  checkInDay: number
  checkOutDay: number
  daysInMonth: number
  colWidth: number
  isAnyDragging: boolean
  isThisBeingDragged: boolean
  onClick: (booking: BookingWithRelations) => void
  onDragStart: (booking: BookingWithRelations, offsetDays: number) => void
}

export function BookingBar({
  booking,
  checkInDay,
  checkOutDay,
  daysInMonth,
  colWidth,
  isAnyDragging,
  isThisBeingDragged,
  onClick,
  onDragStart,
}: BookingBarProps) {
  // Clamp display range to current month
  const displayStart = Math.max(0, checkInDay - 1) // 0-indexed column
  const displayEnd   = Math.min(daysInMonth, checkOutDay - 1) // exclusive
  const displayNights = displayEnd - displayStart
  if (displayNights <= 0) return null

  const canDrag = !['CANCELLED', 'CHECKED_OUT'].includes(booking.status)
  const startsThisMonth = checkInDay >= 1
  const endsThisMonth   = checkOutDay <= daysInMonth + 1

  function handleDragStart(e: React.DragEvent) {
    if (!canDrag) { e.preventDefault(); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mouseRelX = Math.max(0, e.clientX - rect.left)
    const offsetFromBarStart = Math.floor(mouseRelX / colWidth)
    // Days of the booking clipped off on the left (started before this month)
    const clippedDays = Math.max(0, 1 - checkInDay)
    const offsetDays = clippedDays + offsetFromBarStart
    e.dataTransfer.effectAllowed = 'move'
    onDragStart(booking, offsetDays)
  }

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
        startsThisMonth && endsThisMonth  && 'rounded-full',
        startsThisMonth && !endsThisMonth && 'rounded-l-full',
        !startsThisMonth && endsThisMonth && 'rounded-r-full',
        isThisBeingDragged && 'opacity-40',
        isAnyDragging && !isThisBeingDragged && 'pointer-events-none',
      )}
    >
      <span className="truncate px-3 text-xs font-semibold text-white">
        {booking.guest.firstName}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/calendar/BookingBar.tsx
git commit -m "feat: add BookingBar draggable component"
```

---

### Task 6: `BookingSlideOver`

**Files:**
- Create: `src/components/admin/calendar/BookingSlideOver.tsx`

**Interfaces:**
- Consumes: `StatusBadge`, `SourceBadge` de `@/components/ui/Badge`; `formatDate`, `formatCurrency`, `calculateNights` de `@/lib/utils`; `BookingWithRelations` de `@/types`
- Produces:
  ```ts
  export function BookingSlideOver(props: {
    booking: BookingWithRelations | null
    onClose: () => void
    onStatusChange: (id: string, status: string) => Promise<void>
    updatingId: string | null
  }): JSX.Element
  ```

- [ ] **Step 1: Crear `src/components/admin/calendar/BookingSlideOver.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { X, LogIn, LogOut, Check, ExternalLink } from 'lucide-react'
import { cn, formatDate, formatCurrency, calculateNights } from '@/lib/utils'
import { StatusBadge, SourceBadge } from '@/components/ui/Badge'
import type { BookingWithRelations } from '@/types'

interface BookingSlideOverProps {
  booking: BookingWithRelations | null
  onClose: () => void
  onStatusChange: (id: string, status: string) => Promise<void>
  updatingId: string | null
}

export function BookingSlideOver({ booking, onClose, onStatusChange, updatingId }: BookingSlideOverProps) {
  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (booking) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [booking, onClose])

  const isUpdating = updatingId === booking?.id

  return (
    <div className={cn('fixed inset-0 z-50 flex justify-end', !booking && 'pointer-events-none')}>
      {/* Overlay */}
      <div
        className={cn(
          'absolute inset-0 bg-black/30 transition-opacity duration-200',
          booking ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'relative z-10 flex h-full w-[380px] flex-col bg-white shadow-2xl transition-transform duration-200 ease-out',
          booking ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {booking && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 p-6">
              <div>
                <p className="text-lg font-bold text-slate-900">
                  {booking.guest.firstName} {booking.guest.lastName}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">{booking.room.name}</p>
                <div className="mt-2">
                  <StatusBadge status={booking.status} />
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Details */}
            <div className="flex-1 overflow-y-auto p-6">
              <dl className="space-y-3">
                {[
                  ['Entrada',  formatDate(booking.checkInDate)],
                  ['Salida',   formatDate(booking.checkOutDate)],
                  ['Noches',   String(calculateNights(booking.checkInDate, booking.checkOutDate))],
                  ['Total',    formatCurrency(booking.totalAmount)],
                  ['Depósito', booking.depositPaid ? '✓ Pagado' : '✗ Pendiente'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between">
                    <dt className="text-sm text-slate-500">{label}</dt>
                    <dd className="text-sm font-semibold text-slate-800">{value}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-slate-500">Origen</dt>
                  <dd><SourceBadge source={booking.source} /></dd>
                </div>
                {booking.notes && (
                  <div className="pt-1">
                    <dt className="mb-1 text-sm text-slate-500">Notas</dt>
                    <dd className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{booking.notes}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Actions */}
            <div className="border-t border-slate-100 p-6 space-y-2">
              {booking.status === 'PENDING' && (
                <button
                  onClick={() => onStatusChange(booking.id, 'CONFIRMED')}
                  disabled={isUpdating}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                >
                  <Check className="h-4 w-4" />
                  Confirmar reserva
                </button>
              )}
              {booking.status === 'CONFIRMED' && (
                <button
                  onClick={() => onStatusChange(booking.id, 'CHECKED_IN')}
                  disabled={isUpdating}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                >
                  <LogIn className="h-4 w-4" />
                  Registrar check-in
                </button>
              )}
              {booking.status === 'CHECKED_IN' && (
                <button
                  onClick={() => onStatusChange(booking.id, 'CHECKED_OUT')}
                  disabled={isUpdating}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Registrar check-out
                </button>
              )}
              {!['CANCELLED', 'CHECKED_OUT'].includes(booking.status) && (
                <button
                  onClick={() => onStatusChange(booking.id, 'CANCELLED')}
                  disabled={isUpdating}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Cancelar reserva
                </button>
              )}
              <a
                href="/admin/reservas"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Ver reserva completa
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/calendar/BookingSlideOver.tsx
git commit -m "feat: add BookingSlideOver panel component"
```

---

### Task 7: `RoomRow`

**Files:**
- Create: `src/components/admin/calendar/RoomRow.tsx`

**Interfaces:**
- Consumes: `BookingBar` (Task 5), `STATUS_BG`, tipos de `@/types`
- Produces:
  ```ts
  export interface GhostBar {
    roomId: string
    startDay: number   // 1-indexed
    nights: number
    isValid: boolean
  }

  export function RoomRow(props: {
    room: { id: string; name: string }
    bookings: BookingWithRelations[]
    year: number
    month: number
    daysInMonth: number
    colWidth: number
    roomLabelWidth: number
    today: Date
    draggingBookingId: string | null
    ghostBar: GhostBar | null
    onCellClick: (roomId: string, day: number) => void
    onBookingClick: (booking: BookingWithRelations) => void
    onDragStart: (booking: BookingWithRelations, offsetDays: number) => void
    onDragOver: (e: React.DragEvent, roomId: string, day: number) => void
    onDrop: (e: React.DragEvent, roomId: string, day: number) => void
  }): JSX.Element
  ```

- [ ] **Step 1: Crear `src/components/admin/calendar/RoomRow.tsx`**

```tsx
import { useRef } from 'react'
import { isSameDay, isWithinInterval, addDays } from 'date-fns'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BookingBar } from './BookingBar'
import type { BookingWithRelations } from '@/types'
import { differenceInCalendarDays } from 'date-fns'

export interface GhostBar {
  roomId: string
  startDay: number
  nights: number
  isValid: boolean
}

// Day number (1-indexed) in the given month for a date; can be ≤ 0 or > daysInMonth
function toDayInMonth(date: Date | string, year: number, month: number): number {
  return differenceInCalendarDays(new Date(date), new Date(year, month, 1)) + 1
}

interface RoomRowProps {
  room: { id: string; name: string }
  bookings: BookingWithRelations[]
  year: number
  month: number
  daysInMonth: number
  colWidth: number
  roomLabelWidth: number
  today: Date
  draggingBookingId: string | null
  ghostBar: GhostBar | null
  onCellClick: (roomId: string, day: number) => void
  onBookingClick: (booking: BookingWithRelations) => void
  onDragStart: (booking: BookingWithRelations, offsetDays: number) => void
  onDragOver: (e: React.DragEvent, roomId: string, day: number) => void
  onDrop: (e: React.DragEvent, roomId: string, day: number) => void
}

export function RoomRow({
  room, bookings, year, month, daysInMonth, colWidth, roomLabelWidth,
  today, draggingBookingId, ghostBar,
  onCellClick, onBookingClick, onDragStart, onDragOver, onDrop,
}: RoomRowProps) {
  const dayAreaRef = useRef<HTMLDivElement>(null)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const isAnyDragging = draggingBookingId !== null

  function getDayFromEvent(e: React.DragEvent): number {
    if (!dayAreaRef.current) return 1
    const rect = dayAreaRef.current.getBoundingClientRect()
    const relX = e.clientX - rect.left
    return Math.max(1, Math.min(daysInMonth, Math.floor(relX / colWidth) + 1))
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    onDragOver(e, room.id, getDayFromEvent(e))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    onDrop(e, room.id, getDayFromEvent(e))
  }

  const myGhostBar = ghostBar?.roomId === room.id ? ghostBar : null

  return (
    <div className="flex" style={{ height: 52 }}>
      {/* Room label — sticky left */}
      <div
        className="sticky left-0 z-10 flex flex-none items-center border-r border-slate-100 bg-white px-4"
        style={{ width: roomLabelWidth, minWidth: roomLabelWidth }}
      >
        <span className="text-sm font-semibold text-slate-700 truncate">{room.name}</span>
      </div>

      {/* Day area — drop zone + bars */}
      <div
        ref={dayAreaRef}
        className="relative"
        style={{ width: daysInMonth * colWidth, minWidth: daysInMonth * colWidth }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Background cells */}
        {days.map((day) => {
          const date = new Date(year, month, day)
          const isToday = isSameDay(date, today)
          const dayOfWeek = (date.getDay() + 6) % 7
          const isWeekend = dayOfWeek >= 5
          const hasBooking = bookings.some(
            (b) =>
              b.status !== 'CANCELLED' &&
              isWithinInterval(date, {
                start: new Date(b.checkInDate),
                end: addDays(new Date(b.checkOutDate), -1),
              })
          )
          return (
            <div
              key={day}
              style={{ position: 'absolute', left: (day - 1) * colWidth, width: colWidth, top: 0, bottom: 0 }}
              className={cn(
                'border-r border-slate-100 group',
                isToday && !hasBooking && 'bg-indigo-50/50',
                isWeekend && !isToday && 'bg-slate-50/60',
                !hasBooking && !isAnyDragging && 'hover:bg-indigo-50 cursor-pointer',
              )}
              onClick={() => !hasBooking && !isAnyDragging && onCellClick(room.id, day)}
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
        {bookings.map((booking) => (
          <BookingBar
            key={booking.id}
            booking={booking}
            checkInDay={toDayInMonth(booking.checkInDate, year, month)}
            checkOutDay={toDayInMonth(booking.checkOutDate, year, month)}
            daysInMonth={daysInMonth}
            colWidth={colWidth}
            isAnyDragging={isAnyDragging}
            isThisBeingDragged={booking.id === draggingBookingId}
            onClick={onBookingClick}
            onDragStart={onDragStart}
          />
        ))}

        {/* Ghost bar preview during drag */}
        {myGhostBar && (
          <div
            className={cn(
              'pointer-events-none absolute rounded-full border-2 border-dashed',
              myGhostBar.isValid
                ? 'bg-indigo-200/50 border-indigo-400'
                : 'bg-red-200/50 border-red-400'
            )}
            style={{
              left:   Math.max(0, myGhostBar.startDay - 1) * colWidth + 2,
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

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/calendar/RoomRow.tsx
git commit -m "feat: add RoomRow component with drag drop zone and ghost bar"
```

---

### Task 8: `CalendarGrid`

**Files:**
- Create: `src/components/admin/calendar/CalendarGrid.tsx`

**Interfaces:**
- Consumes: `DayHeaders` (Task 4), `RoomRow` (Task 7), `GhostBar` type de `RoomRow`
- Produces:
  ```ts
  export const COL_WIDTH = 36
  export const ROOM_LABEL_WIDTH = 160
  export function CalendarGrid(props: {
    year: number
    month: number
    daysInMonth: number
    rooms: { id: string; name: string }[]
    bookings: BookingWithRelations[]
    today: Date
    draggingBookingId: string | null
    ghostBar: GhostBar | null
    onCellClick: (roomId: string, day: number) => void
    onBookingClick: (booking: BookingWithRelations) => void
    onDragStart: (booking: BookingWithRelations, offsetDays: number) => void
    onDragOver: (e: React.DragEvent, roomId: string, day: number) => void
    onDrop: (e: React.DragEvent, roomId: string, day: number) => void
    onDragEnd: () => void
  }): JSX.Element
  ```

- [ ] **Step 1: Crear `src/components/admin/calendar/CalendarGrid.tsx`**

```tsx
import { DayHeaders } from './DayHeaders'
import { RoomRow, type GhostBar } from './RoomRow'
import type { BookingWithRelations } from '@/types'

export const COL_WIDTH = 36
export const ROOM_LABEL_WIDTH = 160

interface CalendarGridProps {
  year: number
  month: number
  daysInMonth: number
  rooms: { id: string; name: string }[]
  bookings: BookingWithRelations[]
  today: Date
  draggingBookingId: string | null
  ghostBar: GhostBar | null
  onCellClick: (roomId: string, day: number) => void
  onBookingClick: (booking: BookingWithRelations) => void
  onDragStart: (booking: BookingWithRelations, offsetDays: number) => void
  onDragOver: (e: React.DragEvent, roomId: string, day: number) => void
  onDrop: (e: React.DragEvent, roomId: string, day: number) => void
  onDragEnd: () => void
}

export function CalendarGrid({
  year, month, daysInMonth, rooms, bookings, today,
  draggingBookingId, ghostBar,
  onCellClick, onBookingClick, onDragStart, onDragOver, onDrop, onDragEnd,
}: CalendarGridProps) {
  const totalWidth = ROOM_LABEL_WIDTH + daysInMonth * COL_WIDTH

  return (
    <div className="overflow-x-auto" onDragEnd={onDragEnd}>
      <div style={{ minWidth: totalWidth }}>

        {/* Header row — sticky top */}
        <div className="sticky top-0 z-20 flex border-b border-slate-100 bg-white">
          {/* Corner: sticky left AND top */}
          <div
            className="sticky left-0 z-30 flex flex-none items-end bg-slate-50 border-r border-slate-100 px-4 pb-2"
            style={{ width: ROOM_LABEL_WIDTH, minWidth: ROOM_LABEL_WIDTH }}
          >
            <span className="text-xs font-semibold text-slate-500">Habitación</span>
          </div>
          <DayHeaders
            year={year}
            month={month}
            daysInMonth={daysInMonth}
            today={today}
            colWidth={COL_WIDTH}
          />
        </div>

        {/* Room rows */}
        <div className="divide-y divide-slate-100">
          {rooms.map((room) => (
            <RoomRow
              key={room.id}
              room={room}
              bookings={bookings.filter((b) => b.roomId === room.id)}
              year={year}
              month={month}
              daysInMonth={daysInMonth}
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

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/calendar/CalendarGrid.tsx
git commit -m "feat: add CalendarGrid with sticky headers"
```

---

### Task 9: Reescribir `HotelCalendar` — Orquestador

**Files:**
- Modify: `src/components/admin/HotelCalendar.tsx`

**Interfaces:**
- Consumes: todos los componentes de Tasks 2–8
- Produces: `export function HotelCalendar(): JSX.Element` — interfaz pública sin cambios

- [ ] **Step 1: Reemplazar el contenido completo de `src/components/admin/HotelCalendar.tsx`**

```tsx
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

export function HotelCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
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

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(currentDate)
  const today = new Date()

  const load = useCallback(async () => {
    setLoading(true)
    const from = new Date(year, month, 1).toISOString()
    const to   = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
    const [r, b] = await Promise.all([
      fetch('/api/rooms').then((res) => res.json()),
      fetch(`/api/bookings?from=${from}&to=${to}`).then((res) => res.json()),
    ])
    setRooms(r)
    setBookings(b)
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  // --- Toast helpers ---
  function addToast(type: 'success' | 'error', message: string) {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, type, message }])
  }
  function removeToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  // --- Drag handlers ---
  function handleDragStart(booking: BookingWithRelations, offsetDays: number) {
    setDragState({ bookingId: booking.id, offsetDays })
  }

  function handleDragOver(e: React.DragEvent, roomId: string, day: number) {
    e.preventDefault()
    if (!dragState) return
    const booking = bookings.find((b) => b.id === dragState.bookingId)
    if (!booking) return

    const newCheckIn  = new Date(year, month, day - dragState.offsetDays)
    const nights      = differenceInCalendarDays(new Date(booking.checkOutDate), new Date(booking.checkInDate))
    const newCheckOut = addDays(newCheckIn, nights)
    const startDay    = differenceInCalendarDays(newCheckIn, new Date(year, month, 1)) + 1

    const conflict = bookings.some(
      (b) =>
        b.id !== dragState.bookingId &&
        b.roomId === roomId &&
        !['CANCELLED', 'CHECKED_OUT'].includes(b.status) &&
        new Date(b.checkInDate) < newCheckOut &&
        new Date(b.checkOutDate) > newCheckIn
    )

    setGhostBar({ roomId, startDay, nights, isValid: !conflict })
  }

  function handleDrop(e: React.DragEvent, roomId: string, day: number) {
    e.preventDefault()
    if (!dragState || !ghostBar || !ghostBar.isValid) return

    const booking = bookings.find((b) => b.id === dragState.bookingId)
    if (!booking) return

    const newCheckIn  = new Date(year, month, day - dragState.offsetDays)
    const nights      = differenceInCalendarDays(new Date(booking.checkOutDate), new Date(booking.checkInDate))
    const newCheckOut = addDays(newCheckIn, nights)
    const previousBookings = bookings

    // Optimistic update
    const targetRoom = rooms.find((r) => r.id === roomId)
    const updated = bookings.map((b): BookingWithRelations => {
      if (b.id !== booking.id) return b
      return {
        ...b,
        checkInDate:  newCheckIn,
        checkOutDate: newCheckOut,
        roomId,
        room: targetRoom ? { ...b.room, id: roomId, name: targetRoom.name } : b.room,
      }
    })
    setBookings(updated)
    setDragState(null)
    setGhostBar(null)

    // API call with rollback on error
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

  // --- Status change (from slide-over) ---
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

  // --- Cell click (new booking) ---
  function handleCellClick(roomId: string, day: number) {
    const checkIn  = new Date(year, month, day).toISOString().split('T')[0]
    const checkOut = new Date(year, month, day + 1).toISOString().split('T')[0]
    setModalDefaults({ roomId, checkIn, checkOut })
    setModalOpen(true)
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <CalendarHeader
          currentDate={currentDate}
          onPrevMonth={() => setCurrentDate(new Date(year, month - 1, 1))}
          onNextMonth={() => setCurrentDate(new Date(year, month + 1, 1))}
          onToday={() => setCurrentDate(new Date())}
        />

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : (
          <CalendarGrid
            year={year}
            month={month}
            daysInMonth={daysInMonth}
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

      <BookingSlideOver
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
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

- [ ] **Step 2: Verificar visualmente en navegador**

Iniciar `npm run dev` y abrir `http://localhost:3000/admin/calendario`.

Comprobar:
1. El calendario carga con barras continuas coloreadas por estado
2. Las barras muestran el nombre del huésped
3. El header de días es sticky al hacer scroll hacia abajo (si hay suficientes habitaciones)
4. La columna de habitaciones es sticky al hacer scroll horizontal
5. Hoy se resalta en índigo, fines de semana en gris suave
6. Clic en barra abre el slide-over con detalles correctos
7. El slide-over se cierra con Esc, clic en overlay o botón ✕
8. Las acciones de estado (Confirmar, Check-in, etc.) funcionan y muestran toast
9. Drag de una barra: se vuelve semi-transparente, aparece barra fantasma azul en destino libre o roja si está ocupado
10. Al soltar en celda libre: la barra se mueve instantáneamente (optimista) y se persiste
11. Al soltar en celda ocupada: no ocurre nada
12. Clic en celda vacía abre modal de nueva reserva con fecha y habitación pre-rellenados
13. Navegación entre meses funciona

- [ ] **Step 3: Commit final**

```bash
git add src/components/admin/HotelCalendar.tsx
git commit -m "feat: rewrite HotelCalendar as Gantt with drag-and-drop and slide-over panel"
```
