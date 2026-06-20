import type { Metadata } from 'next'
import Link from 'next/link'
import {
  LayoutDashboard,
  Users,
  BookOpen,
  BarChart2,
  LogOut,
} from 'lucide-react'
import { NavLink } from './nav-link'

export const metadata: Metadata = {
  title: 'Admin — Al-Qur\'an Academy',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-border flex flex-col bg-sidebar">
        {/* Logo/brand area */}
        <div className="px-6 py-8 border-b border-sidebar-border">
          <h1 className="text-lg font-bold text-sidebar-foreground">
            Al-Qur&apos;an Academy
          </h1>
        </div>

        {/* Nav links */}
        <nav className="flex-1 flex flex-col gap-2 p-4">
          <NavLink
            href="/admin/dashboard"
            icon={<LayoutDashboard className="w-5 h-5" />}
            label="Dashboard"
          />
          <NavLink
            href="/admin/enrollments"
            icon={<Users className="w-5 h-5" />}
            label="Enrollments"
          />
          <NavLink
            href="/admin/courses"
            icon={<BookOpen className="w-5 h-5" />}
            label="Courses"
            disabled
          />
          <NavLink
            href="/admin/reports"
            icon={<BarChart2 className="w-5 h-5" />}
            label="Reports"
            disabled
          />
        </nav>

        {/* Bottom: logout */}
        <div className="border-t border-sidebar-border p-4">
          <Link
            href="/api/auth/logout"
            className="flex items-center gap-3 px-4 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
