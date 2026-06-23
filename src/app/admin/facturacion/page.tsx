import { prisma } from '@/lib/prisma'
import { InvoicesPageClient } from './InvoicesPageClient'
import { toDecimalNumber } from '@/lib/utils'
import { Euro, Clock, CheckCircle2, FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function FacturacionPage() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [allInvoices, monthInvoices, bookingsWithoutInvoice] = await Promise.all([
    prisma.invoice.findMany({
      include: { booking: { include: { guest: true, room: true } } },
      orderBy: { issueDate: 'desc' },
    }),
    prisma.invoice.findMany({
      where: { issueDate: { gte: monthStart, lte: monthEnd } },
      select: { total: true, status: true },
    }),
    prisma.booking.findMany({
      where: {
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
        invoice: null,
      },
      include: { guest: true, room: true },
      orderBy: { checkInDate: 'desc' },
    }),
  ])

  const totalFacturado = allInvoices
    .filter((i) => ['ISSUED', 'PAID'].includes(i.status))
    .reduce((s, i) => s + toDecimalNumber(i.total), 0)

  const pendienteCobro = allInvoices
    .filter((i) => i.status === 'ISSUED')
    .reduce((s, i) => s + toDecimalNumber(i.total), 0)

  const cobradoMes = monthInvoices
    .filter((i) => i.status === 'PAID')
    .reduce((s, i) => s + toDecimalNumber(i.total), 0)

  const stats = [
    {
      title: 'Total facturado',
      value: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totalFacturado),
      subtitle: `${allInvoices.filter((i) => ['ISSUED', 'PAID'].includes(i.status)).length} facturas`,
      icon: FileText,
      accent: false,
    },
    {
      title: 'Pendiente de cobro',
      value: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(pendienteCobro),
      subtitle: `${allInvoices.filter((i) => i.status === 'ISSUED').length} facturas emitidas`,
      icon: Clock,
      accent: pendienteCobro > 0,
    },
    {
      title: 'Cobrado este mes',
      value: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cobradoMes),
      subtitle: `${monthInvoices.filter((i) => i.status === 'PAID').length} pagos recibidos`,
      icon: CheckCircle2,
      accent: false,
    },
    {
      title: 'Sin facturar',
      value: bookingsWithoutInvoice.length,
      subtitle: 'reservas pendientes',
      icon: Euro,
      accent: bookingsWithoutInvoice.length > 0,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Facturación</h1>
        <p className="mt-0.5 text-sm text-slate-500">Gestión de facturas y cobros</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ title, value, subtitle, icon: Icon, accent }) => (
          <div
            key={title}
            className="rounded-xl border bg-white p-5 shadow-sm"
            style={{ borderColor: accent ? '#9FE870' : '#e2e8f0' }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
                {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
              </div>
              <div
                className="rounded-lg p-2.5"
                style={{ background: accent ? '#edfce5' : '#f1f5f9', color: accent ? '#163300' : '#64748b' }}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <InvoicesPageClient
        initialInvoices={allInvoices}
        bookingsWithoutInvoice={bookingsWithoutInvoice}
      />
    </div>
  )
}
