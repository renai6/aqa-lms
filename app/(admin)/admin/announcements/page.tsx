import Link from 'next/link'
import { ChevronRight, Megaphone, Pin } from 'lucide-react'
import { getAdminAnnouncements } from '@/lib/announcements/queries'
import { audienceSummary, formatAnnouncementDate } from '@/lib/announcements/format'
import { PageHeader } from '@/components/admin/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Announcements - AQA Admin' }

const th = 'text-left px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide'

export default async function AnnouncementsPage() {
  const announcements = await getAdminAnnouncements()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Announcements"
        action={
          <Button asChild>
            <Link href="/admin/announcements/new">New Announcement</Link>
          </Button>
        }
      />

      {announcements.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Megaphone className="w-8 h-8" aria-hidden="true" />
          <p className="text-sm">No announcements yet. Create the first one.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className={th}>Title</th>
                <th scope="col" className={th}>Audience</th>
                <th scope="col" className={th}>Status</th>
                <th scope="col" className={th}>Pinned</th>
                <th scope="col" className={th}>Published</th>
                <th scope="col" aria-label="Actions" className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {announcements.map((a) => (
                <tr key={a.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-2 font-medium">
                    <Link href={'/admin/announcements/' + a.id} className="hover:underline">
                      {a.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {audienceSummary(a.audience, a.courseTitles)}
                  </td>
                  <td className="px-4 py-2">
                    {a.isPublished
                      ? <Badge className="bg-green-100 text-green-800 border-green-200">Published</Badge>
                      : <Badge variant="outline">Draft</Badge>}
                  </td>
                  <td className="px-4 py-2">
                    {a.isPinned && (
                      <>
                        <Pin className="w-4 h-4 text-primary" aria-hidden="true" />
                        <span className="sr-only">Pinned</span>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                    {a.publishedAt ? formatAnnouncementDate(a.publishedAt) : '-'}
                  </td>
                  <td className="px-4 py-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={'/admin/announcements/' + a.id}>
                        Edit <ChevronRight className="w-3 h-3 ml-1" aria-hidden="true" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
