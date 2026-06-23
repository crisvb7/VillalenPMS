# Casa La Aldea · PMS & Motor de Reservas

Sistema de gestión hotelera (PMS) y motor de reservas online para casa rural.

## Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Base de datos**: PostgreSQL + Prisma 7 (adaptador `@prisma/adapter-pg`)
- **UI**: Tailwind CSS v4 + Lucide Icons + date-fns v4

## Arranque rápido

### 1. Configura la base de datos

```bash
cp .env.example .env
# Edita DATABASE_URL en .env con tus credenciales PostgreSQL
```

### 2. Crea la base de datos y aplica el schema

```bash
npm run db:push    # Aplica el schema directamente
npm run db:seed    # Inserta 2 habitaciones y datos de prueba
```

### 3. Arranca el servidor

```bash
npm run dev
# Abre http://localhost:3000
```

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Landing page pública |
| `/reserva` | Motor de reservas (fechas → habitación → datos → confirmación) |
| `/admin/reservas` | Tabla de reservas con acciones (confirmar, check-in, cancelar) |
| `/admin/calendario` | Vista Gantt mensual de ocupación |
| `/admin/huespedes` | Listado de huéspedes |
| `/admin/habitaciones` | CRUD de habitaciones |
| `/admin/limpieza` | Estado de limpieza por habitación |

## API

| Endpoint | Métodos |
|----------|---------|
| `/api/rooms` | GET, POST |
| `/api/rooms/[id]` | GET, PUT, DELETE |
| `/api/rooms/[id]/clean` | PATCH (toggle limpieza) |
| `/api/bookings` | GET, POST (anti-overbooking) |
| `/api/bookings/[id]` | GET, PUT, DELETE |
| `/api/guests` | GET, POST |
| `/api/guests/[id]` | GET, PUT |
| `/api/availability` | GET (?checkIn=&checkOut=) |
| `/api/webhooks/channex` | POST (Channel Manager) |

## Scripts

```bash
npm run db:generate  # Regenerar cliente Prisma
npm run db:push      # Aplicar schema
npm run db:migrate   # Migración versionada
npm run db:seed      # Cargar datos de prueba
npm run db:studio    # Prisma Studio (UI visual)
npm run db:reset     # Reset completo + seed
```

## Nota sobre produccion

El proyecto está en G: (exFAT), que no soporta junction points de NTFS. Turbopack (default en Next.js 16) los necesita para el build de producción. Opciones:
1. Mover el proyecto a una partición NTFS
2. Desplegar en Vercel/Railway (buildean en servidores Linux)
3. En `next.config.ts` descomentar `distDir` apuntando a C:\\Temp

Para desarrollo local `npm run dev` funciona perfectamente.

## Seguridad PCI-DSS

No se almacenan datos de tarjetas. Los cobros son externos (TPV físico + transferencia bancaria).

## Parte de viajeros

`src/lib/travel-report.ts` → `generateTravelReport(bookingId)` genera XML para Guardia Civil/Policía.
