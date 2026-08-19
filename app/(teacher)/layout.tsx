import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { LayoutDashboard, BookOpen, LogOut, GraduationCap } from 'lucide-react'
import { NavLink } from '@/app/(admin)/nav-link'
import { TopBar } from '@/components/admin/top-bar'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'

export const metadata: Metadata = {
  title: "Teacher — Al-Qur'an Academy",
}

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session || session.role !== 'TEACHER') redirect('/login')

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, lastName: true },
  })
  const name = user ? user.firstName + ' ' + user.lastName : 'Teacher'

  return (
    <div className="bg-background flex h-dvh">
      {/* Sidebar — dark class activates dark sidebar CSS vars */}
      <aside className="border-sidebar-border bg-sidebar dark flex w-64 shrink-0 flex-col border-r">
        <div className="border-sidebar-border flex items-center gap-3 border-b px-5 py-5">
          <Image
            src="/aqa-logo.png"
            alt="Al-Qur'an Academy"
            width={44}
            height={44}
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
          <div className="leading-none">
            <p className="text-sidebar-foreground text-[11px] font-semibold tracking-wide">
              AL-QUR&apos;AN ACADEMY
            </p>
            <p className="text-sidebar-foreground/70 mt-0.5 text-[9px] tracking-widest">
              INTERNATIONAL
            </p>
          </div>
        </div>

        <nav
          aria-label="Teacher navigation"
          className="flex flex-1 flex-col gap-0.5 p-3"
        >
          <NavLink
            href="/teacher/dashboard"
            icon={<LayoutDashboard className="h-4 w-4" aria-hidden="true" />}
            label="Dashboard"
          />
          <NavLink
            href="/teacher/subjects"
            icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
            label="My Subjects"
          />
        </nav>

        <div className="border-sidebar-border space-y-1 border-t p-3">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="bg-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
              <GraduationCap
                className="text-primary-foreground h-3.5 w-3.5"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0 leading-none">
              <p className="text-sidebar-foreground truncate text-xs font-medium">
                {name}
              </p>
              <p className="text-sidebar-foreground/70 mt-0.5 truncate text-[10px]">
                Teacher
              </p>
            </div>
          </div>
          <a
            href="/api/auth/logout"
            className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Logout</span>
          </a>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-auto">
        <TopBar />
        <div className="flex-1">{children}</div>
      </main>
    </div>
  )
}
