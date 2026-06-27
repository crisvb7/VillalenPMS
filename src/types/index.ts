import type {
  AvailabilityBlock,
  Booking,
  BookingSource,
  BookingStatus,
  ChannelConfig,
  Guest,
  Invoice,
  InvoiceStatus,
  PaymentMethod,
  Room,
} from '@/db/client'

export type { AvailabilityBlock, Booking, BookingSource, BookingStatus, ChannelConfig, Guest, Invoice, InvoiceStatus, PaymentMethod, Room }

export type BookingWithRelations = Booking & {
  guest: Guest
  room: Room
  invoice?: Invoice | null
}

export type InvoiceWithRelations = Invoice & {
  booking: Booking & {
    guest: Guest
    room: Room
  }
}

export type RoomWithBookings = Room & {
  bookings: BookingWithRelations[]
}

export interface AvailabilityResult {
  room: Room
  available: boolean
  pricePerNight: number
  totalNights: number
  totalPrice: number
}

export interface CreateBookingPayload {
  roomId: string
  checkInDate: string
  checkOutDate: string
  source?: BookingSource
  notes?: string
  guestId?: string
  firstName?: string
  lastName?: string
  documentId?: string
  email?: string
  phone?: string
}

export interface ChannexWebhookPayload {
  event_type: 'reservation_new' | 'reservation_modified' | 'reservation_cancelled'
  data: {
    reference: string
    arrival_date: string
    departure_date: string
    nights: number
    room_type_id: string
    room_type_name?: string
    status: string
    source?: string
    amount: number
    guest: {
      name: string
      email?: string
      phone?: string
      document?: string
    }
    notes?: string
  }
}
