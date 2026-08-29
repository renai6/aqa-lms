// lib/student/queries.ts
import { db } from '@/lib/db'
import type { DayOfWeek, AssessmentType, QuestionMediaType, QuestionType, AttemptStatus } from '@prisma/client'
import { pickRelevantAttempt } from '@/lib/assessments/grading'
import { weightedSubjectGrade } from '@/lib/grades/compute'
import { canSeeSubject, subjectGenderFilter } from '@/lib/subjects/visibility'
import { getUserGender } from '@/lib/subjects/access'
import { ACTIVE_COURSE } from '@/lib/courses/archive'
import { ACTIVE_ENROLLMENT } from '@/lib/enrollments/active'

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

export type DashboardPendingPurchase = {
  id: string
  createdAt: Date
  courseTitles: string[]
}

export type StudentDashboard = {
  enrollments: DashboardEnrollment[]
  schedules: DashboardSchedule[]
  announcements: DashboardAnnouncement[]
  pendingPurchases: DashboardPendingPurchase[]
}

const DAY_NUM: Record<string, number> = {
  MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4,
  FRIDAY: 5, SATURDAY: 6, SUNDAY: 7,
}

export async function getStudentDashboard(userId: string): Promise<StudentDashboard> {
  const userGender = await getUserGender(userId)
  const [enrollmentsRaw, announcements, pendingPurchasesRaw] = await Promise.all([
    db.enrollment.findMany({
      where: { userId, ...ACTIVE_ENROLLMENT, course: { ...ACTIVE_COURSE } },
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
              // Only subjects this student may see count toward progress + schedule.
              where: subjectGenderFilter(userGender),
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
    db.purchase.findMany({
      where: { userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        items: {
          // If the course is archived it drops out here and the purchase row
          // survives with an empty courseTitles list; the dashboard renders
          // that case as "Enrollment" (see student/dashboard/page.tsx).
          where: { course: { ...ACTIVE_COURSE } },
          select: { course: { select: { title: true } } },
        },
      },
    }),
  ])

  const pendingPurchases: DashboardPendingPurchase[] = pendingPurchasesRaw.map(p => ({
    id: p.id,
    createdAt: p.createdAt,
    courseTitles: p.items.map(i => i.course.title),
  }))

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

  return { enrollments, schedules, announcements, pendingPurchases }
}

// ─── Course page ─────────────────────────────────────────────────────────────

export type CourseSubject = {
  id: string
  title: string
  description: string | null
  order: number
  totalLessons: number
  completedLessons: number
  totalAssessments: number
  gradedAssessments: number
  averageScore: number | null
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
  const userGender = await getUserGender(userId)
  const [enrollment, course] = await Promise.all([
    db.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId }, ...ACTIVE_ENROLLMENT },
      select: { id: true },
    }),
    db.course.findUnique({
      where: { id: courseId, isPublished: true, ...ACTIVE_COURSE },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        meetLink: true,
        subjects: {
          // Hide subjects restricted to a different gender (D2).
          where: subjectGenderFilter(userGender),
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
            assessments: {
              where: { isPublished: true },
              select: {
                id: true,
                weight: true,
                attempts: {
                  where: { userId },
                  orderBy: { startedAt: 'desc' },
                  select: { status: true, score: true },
                },
              },
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

    // Weighted average (by Assessment.weight) of each assessment's graded
    // percentage. Shared with the teacher final-grade suggestion so both agree.
    const gradeItems = s.assessments.map(a => ({
      weight: a.weight,
      score: pickRelevantAttempt(a.attempts)?.score ?? null,
    }))
    const gradedAssessments = gradeItems.filter(i => i.score != null).length
    const averageScore = weightedSubjectGrade(gradeItems)

    return {
      id: s.id,
      title: s.title,
      description: s.description,
      order: s.order,
      totalLessons: subTotal,
      completedLessons: subDone,
      totalAssessments: s.assessments.length,
      gradedAssessments,
      averageScore,
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
  videoUrl: string | null
  isCompleted: boolean
}

export type StudentAttemptSummary = {
  id: string
  status: AttemptStatus
  score: number | null
}

export type StudentAssessment = {
  id: string
  title: string
  type: AssessmentType
  durationMins: number | null
  passingScore: number | null
  questionCount: number
  // The student's single relevant attempt (in-progress or completed), if any.
  attempt: StudentAttemptSummary | null
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
    where: { id: subjectId, course: { ...ACTIVE_COURSE } },
    select: {
      id: true,
      courseId: true,
      title: true,
      description: true,
      gender: true,
      course: { select: { title: true } },
      schedules: { select: { day: true, startTime: true, endTime: true } },
      lessons: {
        orderBy: { order: 'asc' },
        select: { id: true, title: true, description: true, order: true },
      },
      assessments: {
        where: { isPublished: true },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          title: true,
          type: true,
          durationMins: true,
          passingScore: true,
          _count: { select: { questions: true } },
          attempts: {
            where: { userId },
            orderBy: { startedAt: 'desc' },
            select: { id: true, status: true, score: true },
          },
        },
      },
    },
  })
  if (!subject) return null

  // Hard boundary: a student of the wrong gender cannot open the subject even
  // by direct URL (D2).
  const userGender = await getUserGender(userId)
  if (!canSeeSubject(userGender, subject.gender)) return null

  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: { userId, courseId: subject.courseId },
      ...ACTIVE_ENROLLMENT,
    },
    select: { id: true, batchId: true },
  })
  if (!enrollment) return null

  const lessonIds = subject.lessons.map(l => l.id)

  const [completions, batchContents] = await Promise.all([
    lessonIds.length > 0
      ? db.lessonCompletion.findMany({
          where: { userId, lessonId: { in: lessonIds } },
          select: { lessonId: true },
        })
      : Promise.resolve([]),
    enrollment.batchId && lessonIds.length > 0
      ? db.batchLessonContent.findMany({
          where: { batchId: enrollment.batchId, lessonId: { in: lessonIds } },
          select: { lessonId: true, materialUrl: true, recordingUrl: true, videoUrl: true },
        })
      : Promise.resolve([]),
  ])

  const completedSet = new Set(completions.map(c => c.lessonId))
  const batchContentMap = new Map(batchContents.map(bc => [bc.lessonId, bc]))

  return {
    id: subject.id,
    courseId: subject.courseId,
    title: subject.title,
    description: subject.description,
    course: subject.course,
    schedules: subject.schedules,
    lessons: subject.lessons.map(l => {
      const content = batchContentMap.get(l.id)
      return {
        ...l,
        materialUrl: content?.materialUrl ?? null,
        recordingUrl: content?.recordingUrl ?? null,
        videoUrl: content?.videoUrl ?? null,
        isCompleted: completedSet.has(l.id),
      }
    }),
    assessments: subject.assessments.map(a => {
      const attempt = pickRelevantAttempt(a.attempts)
      return {
        id: a.id,
        title: a.title,
        type: a.type,
        durationMins: a.durationMins,
        passingScore: a.passingScore,
        questionCount: a._count.questions,
        attempt: attempt
          ? { id: attempt.id, status: attempt.status, score: attempt.score }
          : null,
      }
    }),
  }
}

// ─── Assessment launch ────────────────────────────────────────────────────────

export type AssessmentLaunch = {
  id: string
  title: string
  type: AssessmentType
  durationMins: number | null
  passingScore: number | null
  questionCount: number
  courseId: string
  subjectId: string
  subjectTitle: string
  attempt: StudentAttemptSummary | null
}

// Loads an assessment the student may take. Enforces publish + enrollment
// (D8) and returns null when either is not satisfied.
export async function getStudentAssessmentLaunch(
  userId: string,
  aid: string,
): Promise<AssessmentLaunch | null> {
  const assessment = await db.assessment.findFirst({
    where: { id: aid, isPublished: true, subject: { course: { ...ACTIVE_COURSE } } },
    select: {
      id: true,
      title: true,
      type: true,
      durationMins: true,
      passingScore: true,
      subjectId: true,
      subject: { select: { title: true, courseId: true, gender: true } },
      _count: { select: { questions: true } },
      attempts: {
        where: { userId },
        orderBy: { startedAt: 'desc' },
        select: { id: true, status: true, score: true },
      },
    },
  })
  if (!assessment) return null

  const userGender = await getUserGender(userId)
  if (!canSeeSubject(userGender, assessment.subject.gender)) return null

  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: { userId, courseId: assessment.subject.courseId },
      ...ACTIVE_ENROLLMENT,
    },
    select: { id: true },
  })
  if (!enrollment) return null

  const attempt = pickRelevantAttempt(assessment.attempts)

  return {
    id: assessment.id,
    title: assessment.title,
    type: assessment.type,
    durationMins: assessment.durationMins,
    passingScore: assessment.passingScore,
    questionCount: assessment._count.questions,
    courseId: assessment.subject.courseId,
    subjectId: assessment.subjectId,
    subjectTitle: assessment.subject.title,
    attempt: attempt
      ? { id: attempt.id, status: attempt.status, score: attempt.score }
      : null,
  }
}

// ─── Attempt (take + review) ──────────────────────────────────────────────────

export type AttemptOption = {
  id: string
  label: string
  value: string
  isCorrect: boolean
}

export type AttemptQuestion = {
  id: string
  questionText: string
  type: QuestionType
  points: number
  order: number
  mediaType: QuestionMediaType | null
  mediaUrl: string | null
  options: AttemptOption[]
  // The student's answer for this question (null while in progress / unanswered).
  answer: string | null
  isCorrect: boolean | null
  pointsEarned: number | null
}

export type StudentAttempt = {
  id: string
  status: AttemptStatus
  score: number | null
  startedAt: Date
  submittedAt: Date | null
  assessmentId: string
  assessmentTitle: string
  type: AssessmentType
  durationMins: number | null
  passingScore: number | null
  courseId: string
  subjectId: string
  subjectTitle: string
  questions: AttemptQuestion[]
}

// Loads a single attempt owned by the student. Enforces publish + ownership
// + enrollment (D8) and returns null otherwise.
export async function getStudentAttempt(
  userId: string,
  attemptId: string,
): Promise<StudentAttempt | null> {
  const attempt = await db.assessmentAttempt.findFirst({
    where: {
      id: attemptId,
      userId,
      assessment: { isPublished: true, subject: { course: { ...ACTIVE_COURSE } } },
    },
    select: {
      id: true,
      status: true,
      score: true,
      startedAt: true,
      submittedAt: true,
      assessmentId: true,
      assessment: {
        select: {
          title: true,
          type: true,
          durationMins: true,
          passingScore: true,
          subjectId: true,
          subject: { select: { title: true, courseId: true, gender: true } },
          questions: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              questionText: true,
              type: true,
              points: true,
              order: true,
              mediaType: true,
              mediaUrl: true,
              options: { select: { id: true, label: true, value: true, isCorrect: true } },
            },
          },
        },
      },
      answers: {
        select: { questionId: true, answer: true, isCorrect: true, pointsEarned: true },
      },
    },
  })
  if (!attempt) return null

  const userGender = await getUserGender(userId)
  if (!canSeeSubject(userGender, attempt.assessment.subject.gender)) return null

  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: { userId, courseId: attempt.assessment.subject.courseId },
      ...ACTIVE_ENROLLMENT,
    },
    select: { id: true },
  })
  if (!enrollment) return null

  const answerMap = new Map(attempt.answers.map(a => [a.questionId, a]))
  const questions = attempt.assessment.questions.map(q => {
    const a = answerMap.get(q.id)
    return {
      id: q.id,
      questionText: q.questionText,
      type: q.type,
      points: q.points,
      order: q.order,
      mediaType: q.mediaType,
      mediaUrl: q.mediaUrl,
      options: q.options,
      answer: a?.answer ?? null,
      isCorrect: a?.isCorrect ?? null,
      pointsEarned: a?.pointsEarned ?? null,
    }
  })

  return {
    id: attempt.id,
    status: attempt.status,
    score: attempt.score,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    assessmentId: attempt.assessmentId,
    assessmentTitle: attempt.assessment.title,
    type: attempt.assessment.type,
    durationMins: attempt.assessment.durationMins,
    passingScore: attempt.assessment.passingScore,
    courseId: attempt.assessment.subject.courseId,
    subjectId: attempt.assessment.subjectId,
    subjectTitle: attempt.assessment.subject.title,
    questions,
  }
}

// ─── Dashboard recent results ─────────────────────────────────────────────────

export type RecentResult = {
  attemptId: string
  assessmentId: string
  assessmentTitle: string
  courseId: string
  subjectId: string
  subjectTitle: string
  courseTitle: string
  status: AttemptStatus
  score: number | null
  passingScore: number | null
  submittedAt: Date | null
}

// Latest completed (SUBMITTED/GRADED) attempts across the student's enrolled
// courses. Filters on publish (D8).
export async function getStudentRecentResults(
  userId: string,
  limit = 5,
): Promise<RecentResult[]> {
  const userGender = await getUserGender(userId)
  const attempts = await db.assessmentAttempt.findMany({
    where: {
      userId,
      status: { in: ['SUBMITTED', 'GRADED'] },
      assessment: {
        isPublished: true,
        subject: { ...subjectGenderFilter(userGender), course: { ...ACTIVE_COURSE } },
      },
    },
    orderBy: { submittedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      status: true,
      score: true,
      submittedAt: true,
      assessmentId: true,
      assessment: {
        select: {
          title: true,
          passingScore: true,
          subjectId: true,
          subject: {
            select: { title: true, courseId: true, course: { select: { title: true } } },
          },
        },
      },
    },
  })

  return attempts.map(a => ({
    attemptId: a.id,
    assessmentId: a.assessmentId,
    assessmentTitle: a.assessment.title,
    courseId: a.assessment.subject.courseId,
    subjectId: a.assessment.subjectId,
    subjectTitle: a.assessment.subject.title,
    courseTitle: a.assessment.subject.course.title,
    status: a.status,
    score: a.score,
    passingScore: a.assessment.passingScore,
    submittedAt: a.submittedAt,
  }))
}
