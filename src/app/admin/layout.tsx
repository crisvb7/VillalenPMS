import { Sidebar } from '@/components/admin/Sidebar'
import { AdminHeader } from '@/components/admin/AdminHeader'

export const metadata = {
  title: 'PMS · Casa La Aldea',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col pl-64">
        <AdminHeader />
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
