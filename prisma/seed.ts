import 'dotenv/config'
import { PrismaClient } from '../src/db/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Iniciando seed...')

  const room1 = await prisma.room.upsert({
    where: { id: 'room-el-henar' },
    update: {},
    create: {
      id: 'room-el-henar',
      name: 'El Henar',
      capacity: 2,
      basePrice: 85,
      isClean: true,
    },
  })

  const room2 = await prisma.room.upsert({
    where: { id: 'room-la-ermita' },
    update: {},
    create: {
      id: 'room-la-ermita',
      name: 'La Ermita',
      capacity: 4,
      basePrice: 120,
      isClean: true,
    },
  })

  // Huésped de prueba
  const guest = await prisma.guest.upsert({
    where: { documentId: '12345678A' },
    update: {},
    create: {
      firstName: 'María',
      lastName: 'García López',
      documentId: '12345678A',
      email: 'maria.garcia@ejemplo.com',
      phone: '+34 600 123 456',
    },
  })

  // Reserva de prueba (próxima semana)
  const checkIn = new Date()
  checkIn.setDate(checkIn.getDate() + 7)
  checkIn.setHours(14, 0, 0, 0)
  const checkOut = new Date(checkIn)
  checkOut.setDate(checkOut.getDate() + 3)

  const existing = await prisma.booking.findFirst({
    where: { guestId: guest.id, roomId: room1.id, status: 'CONFIRMED' },
  })

  if (!existing) {
    await prisma.booking.create({
      data: {
        guestId: guest.id,
        roomId: room1.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        totalAmount: 85 * 3,
        status: 'CONFIRMED',
        source: 'WEB',
        depositPaid: true,
        notes: 'Reserva de prueba generada por seed',
      },
    })
  }

  console.log('Seed completado:')
  console.log('  Habitaciones:', room1.name, '·', room2.name)
  console.log('  Huésped de prueba:', guest.firstName, guest.lastName)
}

main()
  .catch((e) => {
    console.error('Error en seed:', e)
    process.exit(1)
  })
  .finally(() => pool.end())
