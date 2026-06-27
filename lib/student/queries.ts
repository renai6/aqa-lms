// lib/student/queries.ts
import { db } from '@/lib/db'
import type { DayOfWeek, AssessmentType } from '@prisma/client'

// ─── Dashboard ───────────────────────────────────────────────────────────────

export type DashboardEnrollment = {
  id: string
  courseId: string
  course: { title: string; imageUrl: string | null; tuitionFee: number | null; meetLink: string | null }
  paymentStatus: 'PARTIALLY_PAID' | 'FULLY_PAID'
  enrolledAt: Date
  totalLessons: number
  completedLessons: number
}

export type DashboardSchedule = {
  subjectTitle: string
  day: DayOfWeek
  startTime: string
  endTime: string
}

export type DashboardAnnouncement = {
  id: string
  title: string
  content: string
  createdAt: Date
}

export type StudentDashboard = {
  enrollments: DashboardEnrollment[]
  schedules: DashboardSchedule[]
  announcements: DashboardAnnouncement[]
}

const DAY_NUM: Record<string, number> = {
  MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4,
  FRIDAY: 5, SATURDAY: 6, SUNDAY: 7,
}

export async function getStudentDashboard(userId: string): Promise<StudentDashboard> {
  const [enrollmentsRaw, announcements] = await Promise.all([
    db.enrollment.findMany({
      where: { userId },
      orderBy: { enrolledAt: 'desc' },
      select: {
        id: true,
        courseId: true,
        paymentStatus: true,
        enrolledAt: true,
        course: {
          select: {
            title: true,
            imageUrl: true,
            tuitionFee: true,
            meetLink: true,
            subjects: {
              select: {
                title: true,
                lessons: { select: { id: true } },
                schedules: { select: { day: true, startTime: true, endTime: true } },
              },
            },
          },
        },
      },
    }),
    db.announcement.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, content: true, createdAt: true },
    }),
  ])

  const allLessonIds = enrollmentsRaw.flatMap(e =>
    e.course.subjects.flatMap(s => s.lessons.map(l => l.id))
  )

  const completions =
    allLessonIds.length > 0
      ? await db.lessonCompletion.findMany({
          where: { userId, lessonId: { in: allLessonIds } },
          select: { lessonId: true },
        })
      : []
  const completedSet = new Set(completions.map(c => c.lessonId))

  const schedules: DashboardSchedule[] = []

  const enrollments: DashboardEnrollment[] = enrollmentsRaw.map(e => {
    let totalLessons = 0
    let completedLessons = 0

    for (const subject of e.course.subjects) {
      totalLessons += subject.lessons.length
      completedLessons += subject.lessons.filter(l => completedSet.has(l.id)).length
      for (const sched of subject.schedules) {
        schedules.push({ subjectTitle: subject.title, day: sched.day, startTime: sched.startTime, endTime: sched.endTime })
      }
    }

    return {
      id: e.id,
      courseId: e.courseId,
      course: {
        title: e.course.title,
        imageUrl: e.course.imageUrl,
        tuitionFee: e.course.tuitionFee?.toNumber() ?? null,
        meetLink: e.course.meetLink,
      },
      paymentStatus: e.paymentStatus,
      enrolledAt: e.enrolledAt,
      totalLessons,
      completedLessons,
    }
  })

  // Sort schedules by day of week starting from today
  const jsToday = new Date().getDay() // 0=Sun … 6=Sat
  const todayNum = jsToday === 0 ? 7 : jsToday // Mon=1 … Sun=7
  schedules.sort((a, b) => {
    const aDiff = ((DAY_NUM[a.day] ?? 1) - todayNum + 7) % 7
    const bDiff = ((DAY_NUM[b.day] ?? 1) - todayNum + 7) % 7
    if (aDiff !== bDiff) return aDiff - bDiff
    return a.startTime.localeCompare(b.startTime)
  })

  return { enrollments, schedules, announcements }
}

// ─── Course page ─────────────────────────────────────────────────────────────

export type CourseSubject = {
  id: string
  title: string
  description: string | null
  order: number
  totalLessons: number
  completedLessons: number
  schedules: Array<{ day: DayOfWeek; startTime: string; endTime: string }>
  teachers: Array<{ firstName: string; lastName: string }>
}

export type StudentCourse = {
  id: string
  title: string
  imageUrl: string | null
  meetLink: string | null
  totalLessons: number
  completedLessons: number
  subjects: CourseSubject[]
}

export async function getStudentCourse(
  userId: string,
  courseId: string,
): Promise<StudentCourse | null> {
  const [enrollment, course] = await Promise.all([
    db.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    }),
    db.course.findUnique({
      where: { id: courseId, isPublished: true },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        meetLink: true,
        subjects: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            order: true,
            lessons: { select: { id: true } },
            schedules: { select: { day: true, startTime: true, endTime: true } },
            teachers: {
              select: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
    }),
  ])

  if (!enrollment || !course) return null

  const allLessonIds = course.subjects.flatMap(s => s.lessons.map(l => l.id))
  const completions =
    allLessonIds.length > 0
      ? await db.lessonCompletion.findMany({
          where: { userId, lessonId: { in: allLessonIds } },
          select: { lessonId: true },
        })
      : []
  const completedSet = new Set(completions.map(c => c.lessonId))

  let totalLessons = 0
  let completedLessons = 0

  const subjects: CourseSubject[] = course.subjects.map(s => {
    const subTotal = s.lessons.length
    const subDone = s.lessons.filter(l => completedSet.has(l.id)).length
    totalLessons += subTotal
    completedLessons += subDone
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      order: s.order,
      totalLessons: subTotal,
      completedLessons: subDone,
      schedules: s.schedules,
      teachers: s.teachers.map(t => ({ firstName: t.user.firstName, lastName: t.user.lastName })),
    }
  })

  return { id: course.id, title: course.title, imageUrl: course.imageUrl, meetLink: course.meetLink, totalLessons, completedLessons, subjects }
}

// ─── Subject page ─────────────────────────────────────────────────────────────

export type StudentLesson = {
  id: string
  title: string
  description: string | null
  order: number
  materialUrl: string | null
  recordingUrl: string | null
  isCompleted: boolean
}

export type StudentAssessment = {
  id: string
  title: string
  type: AssessmentType
  durationMins: number | null
  maxAttempts: number | null
  bestScore: number | null
  attemptCount: number
}

export type StudentSubject = {
  id: string
  courseId: string
  title: string
  description: string | null
  course: { title: string }
  schedules: Array<{ day: DayOfWeek; startTime: string; endTime: string }>
  lessons: StudentLesson[]
  assessments: StudentAssessment[]
}

export async function getStudentSubject(
  userId: string,
  subjectId: string,
): Promise<StudentSubject | null> {
  const subject = await db.subject.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      courseId: true,
      title: true,
      description: true,
      course: { select: { title: true } },
      schedules: { select: { day: true, startTime: true, endTime: true } },
      lessons: {
        orderBy: { order: 'asc' },
        select: { id: true, title: true, description: true, order: true, materialUrl: true, recordingUrl: true },
      },
      assessments: {
        select: {
          id: true,
          title: true,
          type: true,
          durationMins: true,
          maxAttempts: true,
          attempts: {
            where: { userId },
            select: { score: true },
          },
        },
      },
    },
  })
  if (!subject) return null

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: subject.courseId } },
    select: { id: true },
  })
  if (!enrollment) return null

  const lessonIds = subject.lessons.map(l => l.id)
  const completions =
    lessonIds.length > 0
      ? await db.lessonCompletion.findMany({
          where: { userId, lessonId: { in: lessonIds } },
          select: { lessonId: true },
        })
      : []
  const completedSet = new Set(completions.map(c => c.lessonId))

  return {
    id: subject.id,
    courseId: subject.courseId,
    title: subject.title,
    description: subject.description,
    course: subject.course,
    schedules: subject.schedules,
    lessons: subject.lessons.map(l => ({ ...l, isCompleted: completedSet.has(l.id) })),
    assessments: subject.assessments.map(a => {
      const scored = a.attempts.filter(att => att.score !== null)
      const bestScore = scored.length > 0 ? Math.max(...scored.map(att => att.score!)) : null
      return {
        id: a.id,
        title: a.title,
        type: a.type,
        durationMins: a.durationMins,
        maxAttempts: a.maxAttempts,
        bestScore,
        attemptCount: a.attempts.length,
      }
    }),
  }
}
