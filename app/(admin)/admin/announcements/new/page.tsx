import { getAnnouncementCourseOptions } from '@/lib/announcements/queries'
import { PageHeader } from '@/components/admin/page-header'
import { AnnouncementForm } from '../announcement-form'

export const metadata = { title: 'New Announcement - AQA Admin' }

export default async function NewAnnouncementPage() {
  const courses = await getAnnouncementCourseOptions()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Announcements', href: '/admin/announcements' },
          { label: 'New' },
        ]}
        title="New Announcement"
      />
      <div className="max-w-3xl">
        <AnnouncementForm courses={courses} />
      </div>
    </div>
  )
}
