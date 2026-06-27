# Calendario Gantt — Diseño

**Fecha:** 2026-06-27  
**Estado:** Aprobado  
**Alcance:** Reemplazar `HotelCalendar.tsx` con un Gantt profesional con drag & drop y slide-over panel

---

## Contexto

El calendario actual (`/admin/calendario`) usa una `<table>` con celdas individuales por día. Las barras de reserva no son continuas, no hay drag & drop, y el detalle de reserva es un pequeño popover. La propiedad tiene **7 habitaciones**.

---

## Objetivo

Un calendario tipo Gantt profesional que permita:
1. Ver las reservas como barras continuas con el nombre del huésped
2. Arrastrar reservas para cambiar fechas y/o habitación simultáneamente
3. Ver y gestionar el detalle de una reserva en un slide-over lateral

---

## Arquitectura de componentes

```
src/components/admin/
├── HotelCalendar.tsx          ← orquestador principal (datos + estado global)
├── calendar/
│   ├── CalendarHeader.tsx     ← toolbar: navegación mes, leyenda, botón Hoy
│   ├── CalendarGrid.tsx       ← grid CSS + scroll horizontal
│   ├── DayHeaders.tsx         ← fila de días sticky top
│   ├── RoomRow.tsx            ← fila de una habitación + drop zone
│   ├── BookingBar.tsx         ← barra draggable de una reserva
│   └── BookingSlideOver.tsx   ← panel lateral deslizante
```

`HotelCalendar.tsx` gestiona: fetch de datos, estado del drag, estado del slide-over, y actualizaciones optimistas. Los subcomponentes son presentacionales o reciben handlers.

---

## Layout visual

- **Estructura:** Grid CSS, no tabla. Columna izquierda sticky (nombres de habitación), header de días sticky top, área central scrollable horizontalmente.
- **Altura de fila:** 52px por habitación.
- **Hoy:** columna con fondo índigo suave (`bg-indigo-50`).
- **Fines de semana:** columna con gris muy leve (`bg-slate-50/60`).
- **Barras:** `position: absolute` dentro de cada fila, `left` y `width` calculados en porcentaje sobre el total de días del mes. Pill shape (`rounded-full`). Coloreadas por estado (paleta actual mantenida).
- **Texto en barra:** solo el nombre del huésped, truncado con `text-ellipsis`.

### Cálculo de posición de barras

```
left  = ((checkInDay - 1) / daysInMonth) * 100 + '%'
width = (nights / daysInMonth) * 100 + '%'
```

Donde `nights = checkOutDay - checkInDay` (días completos).

---

## Drag & Drop (HTML5 nativo)

### Estado de drag

```ts
interface DragState {
  bookingId: string
  offsetDays: number   // día dentro de la barra donde se hizo mousedown
}
```

### Flujo

1. **`dragstart` en `BookingBar`:**
   - Calcula `offsetDays` = día de hoy en la barra − día de check-in
   - Guarda `dragState` en el estado de `HotelCalendar`
   - Aplica `opacity-50` a la barra original

2. **`dragover` en celda día×habitación (dentro de `RoomRow`):**
   - `e.preventDefault()` para habilitar el drop
   - Calcula `targetCheckIn = targetDay - offsetDays`
   - Si la celda destino está ocupada por otra reserva → highlight rojo, cursor `no-drop`
   - Si está libre → highlight azul, muestra barra fantasma translúcida

3. **`drop` en `RoomRow`:**
   - Calcula nuevas fechas: `checkIn = targetDay - offsetDays`, `checkOut = checkIn + duraciónOriginal`
   - Valida que no haya solapamiento con otra reserva en la habitación destino
   - **Actualización optimista:** actualiza `bookings` en estado local inmediatamente
   - Llama a `PUT /api/bookings/[id]` con `{ checkInDate, checkOutDate, roomId }`
   - En error: revierte estado local + muestra toast de error
   - En éxito: muestra toast de éxito discreto

4. **`dragend`:** limpia `dragState`, elimina highlights y barras fantasma

### Restricciones

- Reservas con estado `CANCELLED` o `CHECKED_OUT`: `draggable={false}`, cursor `default`
- No se puede soltar sobre celda ocupada (highlight rojo, drop ignorado)
- Si el drop desplaza la reserva parcialmente fuera del mes visible → las barras se recortan visualmente en los bordes del mes, pero las fechas reales de la reserva se guardan correctamente. No se permite iniciar un drop que resulte en un check-in antes del día 1 del mes visible (el highlight muestra rojo).

---

## BookingSlideOver

Panel fijo a la derecha, 380px de ancho. Se abre al hacer clic en una barra (distinguiendo clic de drag con un umbral de 4px de movimiento).

### Contenido

| Sección | Campos |
|---------|--------|
| Header | Nombre del huésped, habitación, badge de estado, botón cerrar |
| Detalles | Fecha entrada, fecha salida, noches, total, depósito pagado, origen, notas |
| Acciones de estado | Confirmar / Check-in / Check-out / Cancelar (según estado actual) |
| Footer | Enlace "Ver reserva completa" → `/admin/reservas?id=[id]` |

### Comportamiento

- Animación de entrada: `translate-x-full → translate-x-0`, 200ms `ease-out`
- Cierre: botón ✕, tecla `Escape`, clic en overlay semitransparente (`bg-black/30`)
- Las acciones llaman a `PUT /api/bookings/[id]` y recargan datos al completar
- Feedback de carga: spinner en el botón pulsado, resto deshabilitado

---

## Toast de notificaciones

Toast simple en esquina inferior derecha, sin librería externa:
- **Éxito:** fondo verde, icono check, desaparece en 3s
- **Error:** fondo rojo, mensaje del error de la API, desaparece en 5s

Implementado como estado local en `HotelCalendar` + componente `Toast.tsx` en `src/components/ui/`.

---

## Archivos afectados

| Archivo | Acción |
|---------|--------|
| `src/components/admin/HotelCalendar.tsx` | Reescribir completamente |
| `src/components/admin/calendar/CalendarHeader.tsx` | Crear |
| `src/components/admin/calendar/CalendarGrid.tsx` | Crear |
| `src/components/admin/calendar/DayHeaders.tsx` | Crear |
| `src/components/admin/calendar/RoomRow.tsx` | Crear |
| `src/components/admin/calendar/BookingBar.tsx` | Crear |
| `src/components/admin/calendar/BookingSlideOver.tsx` | Crear |
| `src/components/ui/Toast.tsx` | Crear |
| `src/app/admin/calendario/page.tsx` | Sin cambios |
| `src/app/api/bookings/[id]/route.ts` | Extender PUT para aceptar `roomId` + validar anti-overbooking en nueva habitación + actualizar Channex si la habitación tiene `channexRoomTypeId` |

---

## Fuera de alcance

- Vista semanal o anual
- Redimensionar barras arrastrando los extremos (cambiar solo check-in o check-out)
- Autenticación / permisos
- Tests automatizados
