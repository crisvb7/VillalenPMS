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
