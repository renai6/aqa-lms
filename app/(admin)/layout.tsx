import type { Metadata } from 'next'
import {
  LayoutDashboard,
  Users,
  BookOpen,
  BarChart2,
  LogOut,
  UserCog,
  ShieldCheck,
  GraduationCap,
} from 'lucide-react'
import { NavLink } from './nav-link'
import { TopBar } from '@/components/admin/top-bar'
import { getSession } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: "Admin — Al-Qur'an Academy",
}

function roleLabel(role: string) {
  switch (role) {
    case 'SUPER_ADMIN': return 'Super Admin'
    case 'ADMIN': return 'Admin'
    default: return role
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  return (
    <div className="flex h-dvh bg-background">
      {/* Sidebar — dark class activates dark sidebar CSS vars */}
      <aside className="w-64 border-r border-sidebar-border flex flex-col bg-sidebar dark shrink-0">
        {/* Logo / brand area */}
        <div className="px-5 py-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full border-2 border-primary flex items-center justify-center shrink-0">
              <span className="text-primary font-bold text-[10px] tracking-tight">AQA</span>
            </div>
            <div className="leading-none">
              <p className="text-sidebar-foreground text-[11px] font-semibold tracking-wide">
                AL-QUR&apos;AN ACADEMY
              </p>
              <p className="text-sidebar-foreground/50 text-[9px] tracking-widest mt-0.5">
                INTERNATIONAL
              </p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav aria-label="Admin navigation" className="flex-1 flex flex-col gap-0.5 p-3">
          <NavLink
            href="/admin/dashboard"
            icon={<LayoutDashboard className="w-4 h-4" aria-hidden="true" />}
            label="Dashboard"
          />
          <NavLink
            href="/admin/purchases"
            icon={<Users className="w-4 h-4" aria-hidden="true" />}
            label="Purchases"
          />
          <NavLink
            href="/admin/students"
            icon={<GraduationCap className="w-4 h-4" aria-hidden="true" />}
            label="Students"
          />
          <NavLink
            href="/admin/users"
            icon={<UserCog className="w-4 h-4" aria-hidden="true" />}
            label="Users"
          />
          <NavLink
            href="/admin/courses"
            icon={<BookOpen className="w-4 h-4" aria-hidden="true" />}
            label="Courses"
          />
          <NavLink
            href="/admin/reports"
            icon={<BarChart2 className="w-4 h-4" aria-hidden="true" />}
            label="Reports"
            disabled
          />
        </nav>

        {/* Bottom: user chip + logout */}
        <div className="border-t border-sidebar-border p-3 space-y-1">
          {session && (
            <div className="flex items-center gap-2.5 px-3 py-2">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-primary-foreground" aria-hidden="true" />
              </div>
              <div className="leading-none min-w-0">
                <p className="text-sidebar-foreground text-xs font-medium truncate">
                  {roleLabel(session.role)}
                </p>
                <p className="text-sidebar-foreground/50 text-[10px] mt-0.5 truncate">
                  {session.userId.slice(0, 8)}…
                </p>
              </div>
            </div>
          )}
          <a
            href="/api/auth/logout"
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Logout</span>
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        <TopBar />
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  )
}
