import { redirect } from 'next/navigation'
import { Megaphone } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { getStudentAnnouncements } from '@/lib/announcements/queries'
import { AnnouncementCard } from '@/components/student/announcement-card'

export const metadata = { title: 'Announcements - AQA Student' }

export default async function StudentAnnouncementsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const announcements = await getStudentAnnouncements(session.userId)

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 py-10 md:px-10">
      <h1 className="text-foreground text-2xl font-bold tracking-tight">Announcements</h1>
      {announcements.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-12">
          <Megaphone className="h-8 w-8" aria-hidden="true" />
          <p className="text-sm">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} variant="full" />
          ))}
        </div>
      )}
    </div>
  )
}
