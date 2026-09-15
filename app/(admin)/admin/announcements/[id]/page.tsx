import { notFound } from 'next/navigation'
import { getAnnouncementCourseOptions, getAnnouncementForEdit } from '@/lib/announcements/queries'
import { PageHeader } from '@/components/admin/page-header'
import { Badge } from '@/components/ui/badge'
import { AnnouncementForm } from '../announcement-form'
import { DeleteAnnouncementButton } from './delete-announcement-button'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const announcement = await getAnnouncementForEdit(id)
  return { title: (announcement?.title ?? 'Announcement') + ' - AQA Admin' }
}

export default async function EditAnnouncementPage({ params, searchParams }: Props) {
  const { id } = await params
  const { created } = await searchParams

  const announcement = await getAnnouncementForEdit(id)
  if (!announcement) notFound()

  const courses = await getAnnouncementCourseOptions(announcement.courseIds)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Announcements', href: '/admin/announcements' },
          { label: announcement.title },
        ]}
        title={announcement.title}
        action={
          announcement.isPublished
            ? <Badge className="bg-green-100 text-green-800 border-green-200">Published</Badge>
            : <Badge variant="outline">Draft</Badge>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AnnouncementForm
            announcement={announcement}
            courses={courses}
            initialMessage={created === '1' ? 'Announcement created.' : undefined}
          />
        </div>
        <div>
          <DeleteAnnouncementButton id={announcement.id} title={announcement.title} />
        </div>
      </div>
    </div>
  )
}
