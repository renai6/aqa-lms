import { Pin } from 'lucide-react'
import type { StudentAnnouncement } from '@/lib/announcements/queries'
import { formatAnnouncementDate } from '@/lib/announcements/format'
import { AnnouncementImage } from '@/components/student/announcement-image'

type Props = { announcement: StudentAnnouncement; variant: 'compact' | 'full' }

export function AnnouncementCard({ announcement: a, variant }: Props) {
  if (variant === 'compact') {
    return (
      <div className="border-border flex overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="bg-primary w-[3px] shrink-0" />
        <div className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-foreground flex items-center gap-1.5 text-sm font-medium">
              {a.isPinned && (
                <>
                  <Pin className="text-primary h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="sr-only">Pinned:</span>
                </>
              )}
              <span className="truncate">{a.title}</span>
            </p>
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm whitespace-pre-line wrap-break-word">
              {a.content}
            </p>
            {a.publishedAt && (
              <p className="text-muted-foreground mt-1 text-xs">
                <time dateTime={a.publishedAt.toISOString()}>{formatAnnouncementDate(a.publishedAt)}</time>
              </p>
            )}
          </div>
          {a.imageUrl && <AnnouncementImage src={a.imageUrl} title={a.title} variant="compact" />}
        </div>
      </div>
    )
  }

  return (
    <article className="border-border overflow-hidden rounded-lg border bg-white shadow-sm">
      {a.imageUrl && <AnnouncementImage src={a.imageUrl} title={a.title} variant="full" />}
      <div className="space-y-2 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-foreground min-w-0 text-base font-semibold wrap-break-word">{a.title}</h2>
          {a.isPinned && (
            <span className="text-primary inline-flex items-center gap-1 text-xs font-medium">
              <Pin className="h-3.5 w-3.5" aria-hidden="true" />
              Pinned
            </span>
          )}
        </div>
        {a.publishedAt && (
          <p className="text-muted-foreground text-xs">
            <time dateTime={a.publishedAt.toISOString()}>{formatAnnouncementDate(a.publishedAt)}</time>
          </p>
        )}
        <p className="text-foreground text-sm leading-relaxed whitespace-pre-line wrap-break-word">{a.content}</p>
      </div>
    </article>
  )
}
