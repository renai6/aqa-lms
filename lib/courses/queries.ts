import { db } from '@/lib/db'
import type { CourseType, DayOfWeek } from '@prisma/client'

export type PublishedCourseRow = {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  tuitionFee: number | null
  courseType: CourseType
}

export async function getPublishedCourses(type?: CourseType): Promise<PublishedCourseRow[]> {
  const rows = await db.course.findMany({
    where: { isPublished: true, ...(type ? { courseType: type } : {}) },
    orderBy: { title: 'asc' },
    select: { id: true, title: true, description: true, imageUrl: true, tuitionFee: true, courseType: true },
  })
  return rows.map(r => ({ ...r, tuitionFee: r.tuitionFee?.toNumber() ?? null }))
}

export async function getPublishedCourseById(id: string): Promise<PublishedCourseRow | null> {
  const course = await db.course.findUnique({
    where: { id },
    select: { id: true, title: true, description: true, imageUrl: true, isPublished: true, tuitionFee: true, courseType: true },
  })
  if (!course?.isPublished) return null
  return { id: course.id, title: course.title, description: course.description, imageUrl: course.imageUrl, tuitionFee: course.tuitionFee?.toNumber() ?? null, courseType: course.courseType }
}

export type CourseRow = {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  isPublished: boolean
  courseType: CourseType
  passingGrade: number
  createdAt: Date
  _count: { subjects: number }
}

export type SubjectRow = {
  id: string
  title: string
  description: string | null
  order: number
  units: number
  _count: { lessons: number }
}

export type CourseDetail = {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  isPublished: boolean
  courseType: CourseType
  passingGrade: number
  tuitionFee: number | null
  createdAt: Date
  updatedAt: Date
  subjects: SubjectRow[]
}

export type LessonRow = {
  id: string
  title: string
  description: string | null
  order: number
  materialUrl: string | null
  recordingUrl: string | null
}

export type TeacherRow = {
  userId: string
  assignedAt: Date
  user: { id: string; firstName: string; lastName: string; email: string }
}

export type ScheduleRow = {
  id: string
  day: DayOfWeek
  startTime: string
  endTime: string
}

export type SubjectDetail = {
  id: string
  courseId: string
  title: string
  description: string | null
  order: number
  units: number
  createdAt: Date
  updatedAt: Date
  course: { title: string }
  lessons: LessonRow[]
  teachers: TeacherRow[]
  schedules: ScheduleRow[]
}

export type LessonDetail = {
  id: string
  subjectId: string
  title: string
  description: string | null
  order: number
  materialUrl: string | null
  recordingUrl: string | null
  updatedAt: Date
  subject: { id: string; title: string; courseId: string; course: { title: string } }
}

export type TeacherOption = {
  id: string
  firstName: string
  lastName: string
  email: string
}

export async function getCourses(): Promise<CourseRow[]> {
  return db.course.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      isPublished: true,
      courseType: true,
      passingGrade: true,
      createdAt: true,
      _count: {
        select: { subjects: true },
      },
    },
  })
}

export async function getCourseById(id: string): Promise<CourseDetail | null> {
  const raw = await db.course.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      isPublished: true,
      courseType: true,
      passingGrade: true,
      tuitionFee: true,
      createdAt: true,
      updatedAt: true,
      subjects: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
          units: true,
          _count: {
            select: { lessons: true },
          },
        },
      },
    },
  })
  if (!raw) return null
  return {
    ...raw,
    tuitionFee: raw.tuitionFee ? raw.tuitionFee.toNumber() : null,
  }
}

export async function getSubjectById(sid: string): Promise<SubjectDetail | null> {
  return db.subject.findUnique({
    where: { id: sid },
    select: {
      id: true,
      courseId: true,
      title: true,
      description: true,
      order: true,
      units: true,
      createdAt: true,
      updatedAt: true,
      course: {
        select: { title: true },
      },
      lessons: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
          materialUrl: true,
          recordingUrl: true,
        },
      },
      teachers: {
        select: {
          userId: true,
          assignedAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      schedules: {
        select: {
          id: true,
          day: true,
          startTime: true,
          endTime: true,
        },
      },
    },
  })
}

export async function getLessonById(lid: string): Promise<LessonDetail | null> {
  return db.lesson.findUnique({
    where: { id: lid },
    select: {
      id: true,
      subjectId: true,
      title: true,
      description: true,
      order: true,
      materialUrl: true,
      recordingUrl: true,
      updatedAt: true,
      subject: {
        select: {
          id: true,
          title: true,
          courseId: true,
          course: {
            select: { title: true },
          },
        },
      },
    },
  })
}

export async function getTeachers(): Promise<TeacherOption[]> {
  return db.user.findMany({
    where: { role: 'TEACHER' },
    orderBy: { lastName: 'asc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  })
}
