import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  color: 'brand' | 'emerald' | 'amber' | 'rose' | 'sky'
}

const colorMap = {
  brand:   { bg: '#edfce5', icon: '#163300', border: '#9FE870' },
  emerald: { bg: 'rgb(240 253 244)', icon: '#059669', border: 'rgb(167 243 208)' },
  amber:   { bg: 'rgb(255 251 235)', icon: '#d97706', border: 'rgb(252 211 77)' },
  rose:    { bg: 'rgb(255 241 242)', icon: '#e11d48', border: 'rgb(253 164 175)' },
  sky:     { bg: 'rgb(240 249 255)', icon: '#0284c7', border: 'rgb(186 230 253)' },
}

export function StatCard({ title, value, subtitle, icon: Icon, color }: StatCardProps) {
  const c = colorMap[color]
  return (
    <div className={cn('rounded-xl border p-5 bg-white shadow-sm')} style={{ borderColor: c.border }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="rounded-lg p-2.5" style={{ background: c.bg }}>
          <Icon className="h-5 w-5" style={{ color: c.icon }} />
        </div>
      </div>
    </div>
  )
}
