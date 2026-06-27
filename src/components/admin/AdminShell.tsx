'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { AdminHeader } from './AdminHeader'
import { cn } from '@/lib/utils'

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem('sidebar-collapsed') === 'true')
  }, [])

  function toggle() {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev))
      return !prev
    })
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div
        className={cn(
          'flex min-h-screen flex-1 flex-col transition-all duration-200',
          collapsed ? 'pl-14' : 'pl-64'
        )}
      >
        <AdminHeader />
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
