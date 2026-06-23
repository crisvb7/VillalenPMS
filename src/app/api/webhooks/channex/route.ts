import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyWebhookSignature } from '@/lib/channex'
import type { ChannexWebhookPayload } from '@/types'
import type { BookingSource } from '@/db/client'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    // Verify signature if a secret is configured
    const signature = req.headers.get('x-channex-signature')
    const config = await prisma.channelConfig.findUnique({ where: { channel: 'channex' } })
    if (config?.webhookSecret && signature) {
      const valid = await verifyWebhookSignature(rawBody, signature, config.webhookSecret)
      if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody) as ChannexWebhookPayload
    const { event_type, data } = payload

    if (!event_type || !data) return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })

    if (event_type === 'reservation_cancelled') {
      const existing = await prisma.booking.findFirst({ where: { notes: { contains: data.reference } } })
      if (existing) {
        await prisma.booking.update({ where: { id: existing.id }, data: { status: 'CANCELLED' } })
      }
      return NextResponse.json({ success: true, action: 'cancelled' })
    }

    if (event_type === 'reservation_new' || event_type === 'reservation_modified') {
      const checkInDate = new Date(data.arrival_date)
      const checkOutDate = new Date(data.departure_date)

      const sourceMap: Record<string, BookingSource> = {
        'booking.com': 'BOOKING', booking: 'BOOKING', airbnb: 'AIRBNB',
      }
      const source: BookingSource = sourceMap[data.source?.toLowerCase() ?? ''] ?? 'MANUAL'

      const nameParts = data.guest.name.trim().split(' ')
      const firstName = nameParts[0] ?? data.guest.name
      const lastName = nameParts.slice(1).join(' ') || 'N/A'
      const documentId = data.guest.document ?? `CHANNEX-${data.reference}`
      const email = data.guest.email ?? `${data.reference}@channex.noreply`

      const guest = await prisma.guest.upsert({
        where: { documentId },
        update: { firstName, lastName, email, phone: data.guest.phone || null },
        create: { firstName, lastName, documentId, email, phone: data.guest.phone || null },
      })

      // Find room by Channex room_type_id first, then fall back to name match
      const room = await prisma.room.findFirst({
        where: {
          OR: [
            { channexRoomTypeId: data.room_type_id },
            { name: { contains: data.room_type_name ?? '', mode: 'insensitive' } },
          ],
        },
      })

      if (!room) {
        return NextResponse.json(
          { error: `Habitación no encontrada para room_type_id: ${data.room_type_id}` },
          { status: 404 }
        )
      }

      const existing = await prisma.booking.findFirst({ where: { notes: { contains: data.reference } } })

      if (existing && event_type === 'reservation_modified') {
        const updated = await prisma.booking.update({
          where: { id: existing.id },
          data: { checkInDate, checkOutDate, totalAmount: data.amount, status: 'CONFIRMED' },
        })
        return NextResponse.json({ success: true, action: 'updated', booking: updated })
      }

      const nights = data.nights || Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / 86400000)

      const conflict = await prisma.booking.findFirst({
        where: {
          roomId: room.id,
          status: { notIn: ['CANCELLED'] },
          AND: [{ checkInDate: { lt: checkOutDate } }, { checkOutDate: { gt: checkInDate } }],
        },
      })
      if (conflict) console.warn(`[Channex Webhook] Overbooking detectado: ref ${data.reference}`)

      const booking = await prisma.booking.create({
        data: {
          guestId: guest.id, roomId: room.id,
          checkInDate, checkOutDate,
          totalAmount: data.amount || Number(room.basePrice) * nights,
          status: 'CONFIRMED', source,
          notes: `Channex ref: ${data.reference}`,
        },
      })

      return NextResponse.json({ success: true, action: 'created', booking })
    }

    return NextResponse.json({ success: true, action: 'ignored' })
  } catch (error) {
    console.error('[Channex Webhook]', error)
    return NextResponse.json({ error: 'Error procesando webhook' }, { status: 500 })
  }
}
