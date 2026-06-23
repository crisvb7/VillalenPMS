'use client'

import { useState } from 'react'
import { formatCurrency, formatDate, toDecimalNumber } from '@/lib/utils'
import { CheckCircle, FileText, X, CreditCard, Banknote, ArrowLeftRight } from 'lucide-react'
import type { InvoiceWithRelations } from '@/types'

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT:     { label: 'Borrador',  className: 'bg-slate-100 text-slate-600' },
  ISSUED:    { label: 'Emitida',   className: 'bg-blue-50 text-blue-700' },
  PAID:      { label: 'Cobrada',   className: 'bg-green-50 text-[#163300]' },
  CANCELLED: { label: 'Anulada',   className: 'bg-red-50 text-red-700' },
}

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  CASH:     <Banknote className="h-3.5 w-3.5" />,
  CARD:     <CreditCard className="h-3.5 w-3.5" />,
  TRANSFER: <ArrowLeftRight className="h-3.5 w-3.5" />,
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia',
}

interface Props {
  invoices: InvoiceWithRelations[]
  onRefresh: () => void
}

export function InvoicesTable({ invoices, onRefresh }: Props) {
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [payModal, setPayModal] = useState<InvoiceWithRelations | null>(null)
  const [payMethod, setPayMethod] = useState<string>('CASH')

  async function markPaid(invoice: InvoiceWithRelations) {
    setUpdatingId(invoice.id)
    try {
      await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAID', paymentMethod: payMethod }),
      })
      setPayModal(null)
      onRefresh()
    } finally {
      setUpdatingId(null)
    }
  }

  async function cancel(id: string) {
    if (!confirm('¿Anular esta factura?')) return
    setUpdatingId(id)
    try {
      await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })
      onRefresh()
    } finally {
      setUpdatingId(null)
    }
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="h-10 w-10 text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-500">No hay facturas</p>
        <p className="text-xs text-slate-400 mt-1">Las facturas emitidas aparecerán aquí</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {['Nº Factura', 'Fecha', 'Huésped', 'Habitación', 'Base', 'IVA 10%', 'Total', 'Estado', 'Pago', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {invoices.map((inv) => {
              const total = toDecimalNumber(inv.total)
              const tax = toDecimalNumber(inv.tax)
              const base = total - tax
              const s = STATUS_LABELS[inv.status] ?? STATUS_LABELS.DRAFT
              return (
                <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-slate-700">
                      {inv.invoiceNumber ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(inv.issueDate)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">
                      {inv.booking.guest.firstName} {inv.booking.guest.lastName}
                    </p>
                    <p className="text-xs text-slate-400">{inv.booking.guest.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700">{inv.booking.room.name}</p>
                    <p className="text-xs text-slate-400">
                      {formatDate(inv.booking.checkInDate)} → {formatDate(inv.booking.checkOutDate)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-600 whitespace-nowrap">
                    {formatCurrency(base)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-600 whitespace-nowrap">
                    {formatCurrency(tax)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                    {formatCurrency(total)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.className}`}>
                      {s.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {inv.paymentMethod ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        {PAYMENT_ICONS[inv.paymentMethod]}
                        {PAYMENT_LABELS[inv.paymentMethod]}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {inv.status === 'ISSUED' && (
                        <button
                          onClick={() => { setPayModal(inv); setPayMethod('CASH') }}
                          disabled={updatingId === inv.id}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-50"
                          style={{ background: '#edfce5', color: '#163300' }}
                        >
                          <CheckCircle className="h-3 w-3" /> Cobrar
                        </button>
                      )}
                      {['ISSUED', 'DRAFT'].includes(inv.status) && (
                        <button
                          onClick={() => cancel(inv.id)}
                          disabled={updatingId === inv.id}
                          className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pay modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-80 rounded-2xl border border-slate-200 bg-white shadow-xl p-6">
            <h3 className="text-base font-bold text-slate-800">Registrar cobro</h3>
            <p className="mt-1 text-sm text-slate-500">
              Factura {payModal.invoiceNumber} · {formatCurrency(payModal.total)}
            </p>
            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-600">Método de pago</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(['CASH', 'CARD', 'TRANSFER'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPayMethod(m)}
                    className="flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-xs font-semibold transition-colors"
                    style={payMethod === m
                      ? { borderColor: '#163300', background: '#edfce5', color: '#163300' }
                      : { borderColor: '#e2e8f0', color: '#64748b' }
                    }
                  >
                    {PAYMENT_ICONS[m]}
                    {PAYMENT_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setPayModal(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => markPaid(payModal)}
                disabled={updatingId === payModal.id}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#163300' }}
              >
                Confirmar cobro
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
