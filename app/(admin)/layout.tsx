import type { Metadata } from 'next'
import {
  LayoutDashboard,
  Users,
  BookOpen,
  BarChart2,
  LogOut,
  UserCog,
} from 'lucide-react'
import { NavLink } from './nav-link'

export const metadata: Metadata = {
  title: 'Admin — Al-Qur\'an Academy',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-border flex flex-col bg-sidebar">
        {/* Logo/brand area */}
        <div className="px-6 py-8 border-b border-sidebar-border">
          <p className="text-lg font-bold text-sidebar-foreground">
            Al-Qur&apos;an Academy
          </p>
        </div>

        {/* Nav links */}
        <nav aria-label="Admin navigation" className="flex-1 flex flex-col gap-2 p-4">
          <NavLink
            href="/admin/dashboard"
            icon={<LayoutDashboard className="w-5 h-5" aria-hidden="true" />}
            label="Dashboard"
          />
          <NavLink
            href="/admin/enrollments"
            icon={<Users className="w-5 h-5" aria-hidden="true" />}
            label="Enrollments"
          />
          <NavLink
            href="/admin/users"
            icon={<UserCog className="w-5 h-5" aria-hidden="true" />}
            label="Users"
          />
          <NavLink
            href="/admin/courses"
            icon={<BookOpen className="w-5 h-5" aria-hidden="true" />}
            label="Courses"
          />
          <NavLink
            href="/admin/reports"
            icon={<BarChart2 className="w-5 h-5" aria-hidden="true" />}
            label="Reports"
            disabled
          />
        </nav>

        {/* Bottom: logout */}
        <div className="border-t border-sidebar-border p-4">
          <a
            href="/api/auth/logout"
            className="flex items-center gap-3 px-4 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="w-5 h-5" aria-hidden="true" />
            <span>Logout</span>
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
