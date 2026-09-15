import type { AnnouncementAudience } from '@prisma/client'

// The server runs in UTC; announcements are dated on the academy's calendar.
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export function formatAnnouncementDate(date: Date): string {
  return dateFormatter.format(date)
}

const SHOWN_TITLES = 2

export function audienceSummary(audience: AnnouncementAudience, courseTitles: string[]): string {
  if (audience === 'EVERYONE') return 'Everyone'
  if (courseTitles.length === 0) return 'No courses'
  const shown = courseTitles.slice(0, SHOWN_TITLES).join(', ')
  const rest = courseTitles.length - SHOWN_TITLES
  return rest > 0 ? `${shown} +${rest} more` : shown
}
