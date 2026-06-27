import { AdminShell } from '@/components/admin/AdminShell'

export const metadata = {
  title: 'PMS · Casa La Aldea',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
