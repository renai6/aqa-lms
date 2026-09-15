import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    enrollment: { findMany: vi.fn() },
    purchase: { findMany: vi.fn() },
    lessonCompletion: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/subjects/access', () => ({ getUserGender: vi.fn() }))
vi.mock('@/lib/announcements/queries', () => ({ getStudentAnnouncements: vi.fn() }))

import { db } from '@/lib/db'
import { getStudentAnnouncements } from '@/lib/announcements/queries'
import { getStudentDashboard, DASHBOARD_ANNOUNCEMENTS } from '@/lib/student/queries'

describe('getStudentDashboard announcements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.enrollment.findMany).mockResolvedValue([] as never)
    vi.mocked(db.purchase.findMany).mockResolvedValue([] as never)
  })

  // One extra row tells the page whether to offer "View all".
  it('asks for one more announcement than the dashboard shows', async () => {
    const announcement = {
      id: 'a1',
      title: 'T',
      content: 'C',
      imageUrl: null,
      isPinned: false,
      publishedAt: new Date(),
    }
    vi.mocked(getStudentAnnouncements).mockResolvedValue([announcement])

    const dashboard = await getStudentDashboard('u1')

    expect(getStudentAnnouncements).toHaveBeenCalledWith('u1', { take: DASHBOARD_ANNOUNCEMENTS + 1 })
    expect(dashboard.announcements).toEqual([announcement])
  })
})
