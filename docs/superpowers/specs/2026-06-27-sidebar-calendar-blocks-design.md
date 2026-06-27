# Spec: Sidebar colapsable, navegación de calendario y bloques de disponibilidad por plataforma

**Fecha:** 2026-06-27  
**Proyecto:** hotel-pms · Casa La Aldea

---

## Resumen

Tres mejoras relacionadas con la experiencia de gestión diaria:

1. **Sidebar colapsable** — minimizar el menú lateral a solo iconos para ganar espacio en pantalla.
2. **Calendario con ventana deslizante** — navegar día a día, arrastrar reservas entre meses, y saltar a un mes/año con un selector.
3. **Bloques de disponibilidad por plataforma** — distinguir visualmente las fechas cerradas en Booking.com/Airbnb de las reservas reales, y poder bloquear fechas manualmente por plataforma desde el calendario.

---

## Feature 1: Sidebar colapsable

### Comportamiento

- Un botón de toggle (icono `PanelLeftClose` / `PanelLeftOpen`) aparece en la cabecera de la sidebar.
- **Expandida** (por defecto): `w-64`, muestra icono + etiqueta texto por cada ítem de navegación.
- **Colapsada**: `w-14` (56 px), muestra solo el icono. El item activo se indica con un fondo verde en el icono.
- Al colapsar, el tooltip con el nombre de la sección aparece al hacer hover sobre el icono.
- El contenido principal pasa de `pl-64` a `pl-14` con transición CSS (`transition-all duration-200`).
- Estado persistido en `localStorage` bajo la clave `sidebar-collapsed`.

### Cambios de arquitectura

- `AdminLayout` (server component) delega la maquetación a un nuevo client component **`AdminShell`**.
- `AdminShell` gestiona el estado `collapsed` y pasa las props `collapsed` + `onToggle` a `Sidebar`.
- `Sidebar` recibe `collapsed: boolean` y `onToggle: () => void` como props.
- `AdminHeader` no cambia.

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/app/admin/layout.tsx` | Renderiza `<AdminShell>` en lugar de estructurar directamente |
| `src/components/admin/AdminShell.tsx` | Nuevo — gestiona estado collapsed, layout flex |
| `src/components/admin/Sidebar.tsx` | Acepta props collapsed/onToggle, renderizado condicional de etiquetas |

---

## Feature 2: Navegación del calendario con ventana deslizante

### Modelo de estado

El estado central cambia de `currentDate: Date` (utilizado como año+mes) a `startDate: Date` — el primer día visible en la ventana.

- **Tamaño de ventana** = número de días del mes al que pertenece `startDate`.
  - Ejemplo: `startDate` = 15 nov 2026 → `getDaysInMonth(startDate)` = 30 → ventana = 15 nov – 14 dic.
- Las columnas representan `startDate + offset` (0-indexado), no el día-del-mes.

### Navegación

| Control | Acción |
|---|---|
| Flecha ← | `startDate = addDays(startDate, -1)` |
| Flecha → | `startDate = addDays(startDate, +1)` |
| Botón "Hoy" | `startDate = today` |
| Selector mes/año | `startDate = new Date(selectedYear, selectedMonth, 1)` |

### Selector mes/año

Dos `<select>` en `CalendarHeader` (inline, junto a las flechas):
- **Mes**: opciones enero–diciembre, en español.
- **Año**: rango `currentYear - 1` a `currentYear + 3`.
- Al cambiar cualquiera de los dos, se actualiza `startDate` al día 1 de ese mes/año.
- El título textual (`"Noviembre 2026"`) se elimina; el selector es el nuevo título.

### Sistema de coordenadas interno

Todos los componentes que actualmente reciben `year`, `month`, `daysInMonth` reciben en su lugar `startDate: Date` y `windowSize: number`.

- `toDayInMonth(date, year, month)` → `differenceInCalendarDays(date, startDate)` = offset de columna (puede ser negativo si la reserva empieza antes de la ventana).
- `BookingBar` recorta al rango `[0, windowSize]`.
- `RoomRow` calcula la fecha real de cada celda como `addDays(startDate, offset)`.
- El drag usa offsets desde `startDate` en lugar de días del mes; funciona de forma natural entre meses sin cambios adicionales.

### Fetch de datos

`HotelCalendar` pasa a la API:
```
from = startDate.toISOString()
to   = addDays(startDate, windowSize).toISOString()
```

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/components/admin/HotelCalendar.tsx` | Estado `startDate`, lógica de navegación actualizada |
| `src/components/admin/calendar/CalendarHeader.tsx` | Selectores mes/año, nuevo contrato de props |
| `src/components/admin/calendar/CalendarGrid.tsx` | Props `startDate` + `windowSize` en lugar de `year/month/daysInMonth` |
| `src/components/admin/calendar/DayHeaders.tsx` | Muestra fecha real (día + abrev. mes) por columna |
| `src/components/admin/calendar/RoomRow.tsx` | Coordenadas basadas en offset desde `startDate` |
| `src/components/admin/calendar/BookingBar.tsx` | Recorte al rango `[0, windowSize]` con offset |

---

## Feature 3: Bloques de disponibilidad por plataforma

### Nuevo modelo de base de datos

```prisma
model AvailabilityBlock {
  id         String   @id @default(cuid())
  roomId     String
  startDate  DateTime
  endDate    DateTime  // exclusivo (estilo checkout)
  platforms  String[]  // ej. ["booking_com"], ["airbnb", "web"], ["all"]
  reason     String?   // "CLOSED", "MAINTENANCE", etc.
  externalId String?   @unique  // para deduplicación en sync iCal
  source     String    @default("manual")  // "manual" | "ical_sync"
  room       Room      @relation(fields: [roomId], references: [id])
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}
```

`Room` añade la relación inversa: `availabilityBlocks AvailabilityBlock[]`.

Migración: `prisma migrate dev --name add_availability_blocks`.

### Fix de iCal sync (Booking.com "CLOSED")

En `src/lib/ical.ts`, función `syncIcalFeed`:

**Antes:** todos los eventos → crear `Guest` + `Booking`.  
**Después:** si el `SUMMARY` del evento contiene alguna de estas palabras clave (`closed`, `not available`, `blocked`, `unavailable`, `not_available`) → crear `AvailabilityBlock` con `source: 'ical_sync'`, `platforms: [platform]`, `externalId: ical-{platform}-{uid}`.

Los eventos normales (reservas de huéspedes reales) continúan creando `Booking` como hasta ahora.

La función `extractGuestName` solo se llama para eventos que superan el filtro de bloqueo.

### API endpoints nuevos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/availability-blocks?from=&to=&roomId=` | Bloques en ventana de fechas |
| `POST` | `/api/availability-blocks` | Crear bloque manual |
| `DELETE` | `/api/availability-blocks/[id]` | Eliminar bloque |

### Visualización en el calendario

**Reservas (sin cambio en altura):**
- Barra completa como ahora.
- Pequeño badge de plataforma en el extremo derecho de la barra: icono o inicial (`B` booking, `A` airbnb, `W` web, `M` manual).
- Color de la barra sigue siendo por estado (`PENDING`, `CONFIRMED`, etc.) — el badge añade contexto de origen.

**Bloques de disponibilidad:**
- Barra delgada (altura 10 px) anclada al borde inferior de la fila.
- Color sólido + patrón `repeating-linear-gradient` diagonal para distinguirlos de reservas.
- Colores por plataforma:
  - `booking_com`: `#003580` (azul Booking)
  - `airbnb`: `#FF5A5F` (coral Airbnb)
  - `web`: `#9FE870` (verde marca)
  - `manual` / `all`: `#94A3B8` (slate-400)
- Si hay múltiples plataformas bloqueadas en el mismo rango → barras delgadas apiladas verticalmente (máx 3 plataformas visibles sin solaparse con la barra de reserva).
- Al hacer hover sobre un bloque → tooltip con plataforma + motivo.
- Los bloques no son arrastrables.

Nuevo componente: `src/components/admin/calendar/BlockBar.tsx`.

`RoomRow` y `CalendarGrid` reciben también `blocks: AvailabilityBlock[]` y los renderiza `BlockBar`.

`HotelCalendar` hace fetch paralelo de bookings + blocks en `load()`.

### Bloqueo manual desde el calendario

Al hacer clic en una celda vacía (sin reserva), en lugar de abrir directamente `NewBookingModal`, aparece un **mini-menú flotante** (popover) con dos opciones:
- **Nueva reserva** → abre `NewBookingModal` como hasta ahora.
- **Bloquear fechas** → abre `BlockDatesModal`.

`BlockDatesModal` contiene:
- Selector de fecha inicio / fecha fin (relleno por defecto con el día clicado).
- Checkboxes de plataformas disponibles para esa habitación, obtenidas de `ICalFeed` + siempre la opción "Web".
- Botón "Bloquear" → `POST /api/availability-blocks`.
- Feedback de éxito/error vía Toast existente.

Nuevo componente: `src/components/admin/BlockDatesModal.tsx`.

### Push de bloqueos a plataformas (iCal export)

El endpoint `GET /api/ical/[roomId]` acepta un query param opcional `?platform=booking_com` (u otra plataforma).

- Si se pasa `platform`, el export incluye solo los `AvailabilityBlock` cuyo array `platforms` contiene ese valor o `'all'`.
- Si no se pasa `platform`, incluye todos los bloques de la habitación (comportamiento legado para compatibilidad).

Esto permite URLs de suscripción por plataforma:
- Booking.com suscribe a: `/api/ical/[roomId]?platform=booking_com`
- Airbnb suscribe a: `/api/ical/[roomId]?platform=airbnb`

Cada bloque se exporta como:
```
BEGIN:VEVENT
UID:block-{id}
DTSTART:{startDate}
DTEND:{endDate}
SUMMARY:CLOSED - Not available
STATUS:CONFIRMED
END:VEVENT
```

**Nota:** iCal es pull-based. Booking.com y Airbnb deben tener configurada la suscripción a nuestra URL de calendario. La propagación puede tardar hasta 24 h según el ciclo de polling de cada plataforma. Las URLs con `?platform=` deben comunicarse a cada OTA para que actualicen su suscripción.

---

## Resumen de nuevos archivos

| Archivo | Propósito |
|---|---|
| `src/components/admin/AdminShell.tsx` | Layout client con estado sidebar |
| `src/components/admin/calendar/BlockBar.tsx` | Barra visual de bloqueo por plataforma |
| `src/components/admin/BlockDatesModal.tsx` | Modal para crear bloqueos manuales |
| `src/app/api/availability-blocks/route.ts` | GET + POST bloques |
| `src/app/api/availability-blocks/[id]/route.ts` | DELETE bloque |
| `prisma/migrations/…/migration.sql` | Añade tabla AvailabilityBlock |

## Resumen de archivos modificados

| Archivo | Cambio principal |
|---|---|
| `prisma/schema.prisma` | Nuevo modelo `AvailabilityBlock` |
| `src/lib/ical.ts` | Detecta eventos "CLOSED" → crea `AvailabilityBlock` |
| `src/app/api/ical/[roomId]/route.ts` | Exporta bloques además de reservas |
| `src/app/admin/layout.tsx` | Delega en `AdminShell` |
| `src/components/admin/Sidebar.tsx` | Props collapsed/onToggle |
| `src/components/admin/HotelCalendar.tsx` | Estado `startDate`, fetch bloques |
| `src/components/admin/calendar/CalendarHeader.tsx` | Selectores mes/año |
| `src/components/admin/calendar/CalendarGrid.tsx` | Props startDate/windowSize, pasa bloques |
| `src/components/admin/calendar/DayHeaders.tsx` | Fechas reales por columna |
| `src/components/admin/calendar/RoomRow.tsx` | Coordenadas offset, renderiza BlockBar |
| `src/components/admin/calendar/BookingBar.tsx` | Badge de plataforma, recorte por offset |
