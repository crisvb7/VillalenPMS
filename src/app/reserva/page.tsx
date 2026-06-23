import Link from 'next/link'
import { BookingWidget } from '@/components/booking/BookingWidget'
import { BedDouble, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Reservar · Casa La Aldea',
  description: 'Comprueba disponibilidad y reserva tu estancia en Casa La Aldea.',
}

export default function ReservaPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <div className="h-4 w-px bg-stone-200" />
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-800">
              <BedDouble className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-stone-800">Casa La Aldea</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-stone-800">Reserva tu estancia</h1>
          <p className="mt-2 text-stone-500">Sin cargos hasta la llegada · Pago por transferencia o en recepción</p>
        </div>

        <BookingWidget />
      </main>
    </div>
  )
}
