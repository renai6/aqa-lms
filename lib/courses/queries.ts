import { db } from "@/lib/db";
import { groupCourses } from "@/lib/courses/grouping";
import { ACTIVE_COURSE } from "@/lib/courses/archive";
import type {
  CourseType,
  CourseDuration,
  DayOfWeek,
  Gender,
  PaymentFrequency,
} from "@prisma/client";

export type PublishedCourseRow = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  tuitionFee: number | null;
  courseType: CourseType;
  meetLink: string | null;
  courseDuration: CourseDuration | null;
  paymentFrequency: PaymentFrequency | null;
  miscFeeNote: string | null;
  groupName: string | null;
  level: number | null;
};

export async function getPublishedCourses(
  type?: CourseType,
): Promise<PublishedCourseRow[]> {
  const rows = await db.course.findMany({
    where: { isPublished: true, ...ACTIVE_COURSE, ...(type ? { courseType: type } : {}) },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      tuitionFee: true,
      courseType: true,
      meetLink: true,
      courseDuration: true,
      paymentFrequency: true,
      miscFeeNote: true,
      groupName: true,
      level: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    tuitionFee: r.tuitionFee?.toNumber() ?? null,
  }));
}

export type PublicCourseGroup = {
  groupName: string;
  slug: string;
  levels: PublishedCourseRow[];
};

// Resolves a group-page slug to its group of published courses (levels ordered).
export async function getPublicCourseGroup(
  slug: string,
): Promise<PublicCourseGroup | null> {
  const courses = await getPublishedCourses();
  const grouped = groupCourses(courses);
  const match = grouped.find(
    (entry) => entry.kind === "group" && entry.slug === slug,
  );
  if (!match || match.kind !== "group") return null;
  return { groupName: match.groupName, slug: match.slug, levels: match.levels };
}

export type PublicSubjectRow = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  units: number;
  gender: Gender | null;
  _count: { lessons: number };
  schedules: Array<{ day: DayOfWeek; startTime: string; endTime: string }>;
};

export type PublicCourseDetail = PublishedCourseRow & {
  subjects: PublicSubjectRow[];
};

export async function getPublicCourseDetail(
  id: string,
): Promise<PublicCourseDetail | null> {
  const raw = await db.course.findUnique({
    where: { id, isPublished: true, ...ACTIVE_COURSE },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      tuitionFee: true,
      courseType: true,
      meetLink: true,
      courseDuration: true,
      paymentFrequency: true,
      miscFeeNote: true,
      groupName: true,
      level: true,
      subjects: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
          units: true,
          gender: true,
          _count: { select: { lessons: true } },
          schedules: { select: { day: true, startTime: true, endTime: true } },
        },
      },
    },
  });
  if (!raw) return null;
  return { ...raw, tuitionFee: raw.tuitionFee?.toNumber() ?? null };
}

export async function getPublishedCourseById(
  id: string,
): Promise<PublishedCourseRow | null> {
  const course = await db.course.findUnique({
    where: { id, ...ACTIVE_COURSE },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      isPublished: true,
      tuitionFee: true,
      courseType: true,
      meetLink: true,
      courseDuration: true,
      paymentFrequency: true,
      miscFeeNote: true,
      groupName: true,
      level: true,
    },
  });
  if (!course?.isPublished) return null;
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    imageUrl: course.imageUrl,
    tuitionFee: course.tuitionFee?.toNumber() ?? null,
    courseType: course.courseType,
    meetLink: course.meetLink,
    courseDuration: course.courseDuration,
    paymentFrequency: course.paymentFrequency,
    miscFeeNote: course.miscFeeNote,
    groupName: course.groupName,
    level: course.level,
  };
}

export type CourseRow = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  isPublished: boolean;
  courseType: CourseType;
  passingGrade: number;
  meetLink: string | null;
  courseDuration: CourseDuration | null;
  createdAt: Date;
  archivedAt: Date | null;
  _count: { subjects: number };
};

export type SubjectRow = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  units: number;
  gender: Gender | null;
  _count: { lessons: number };
};

export type CourseDetail = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  isPublished: boolean;
  courseType: CourseType;
  passingGrade: number;
  tuitionFee: number | null;
  meetLink: string | null;
  courseDuration: CourseDuration | null;
  paymentFrequency: PaymentFrequency | null;
  miscFeeNote: string | null;
  groupName: string | null;
  level: number | null;
  createdAt: Date;
  updatedAt: Date;
  subjects: SubjectRow[];
};

export type LessonRow = {
  id: string;
  title: string;
  description: string | null;
  order: number;
};

export type TeacherRow = {
  userId: string;
  assignedAt: Date;
  user: { id: string; firstName: string; lastName: string; email: string };
};

export type ScheduleRow = {
  id: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
};

export type SubjectDetail = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number;
  units: number;
  gender: Gender | null;
  createdAt: Date;
  updatedAt: Date;
  course: { title: string };
  lessons: LessonRow[];
  teachers: TeacherRow[];
  schedules: ScheduleRow[];
};

export type LessonDetail = {
  id: string;
  subjectId: string;
  title: string;
  description: string | null;
  order: number;
  updatedAt: Date;
  subject: {
    id: string;
    title: string;
    courseId: string;
    course: { title: string };
  };
};

export type TeacherOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type CourseOption = { id: string; title: string };

// Minimal course list for pickers (e.g. copy-subject target selector).
export async function getCourseOptions(): Promise<CourseOption[]> {
  return db.course.findMany({
    where: { ...ACTIVE_COURSE },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });
}

export async function getCourses(includeArchived = false): Promise<CourseRow[]> {
  return db.course.findMany({
    where: includeArchived ? { archivedAt: { not: null } } : { ...ACTIVE_COURSE },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      isPublished: true,
      courseType: true,
      passingGrade: true,
      meetLink: true,
      courseDuration: true,
      createdAt: true,
      archivedAt: true,
      _count: {
        select: { subjects: true },
      },
    },
  });
}

export async function getCourseById(id: string): Promise<CourseDetail | null> {
  const raw = await db.course.findUnique({
    where: { id, ...ACTIVE_COURSE },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      isPublished: true,
      courseType: true,
      passingGrade: true,
      tuitionFee: true,
      meetLink: true,
      courseDuration: true,
      paymentFrequency: true,
      miscFeeNote: true,
      groupName: true,
      level: true,
      createdAt: true,
      updatedAt: true,
      subjects: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
          units: true,
          gender: true,
          _count: {
            select: { lessons: true },
          },
        },
      },
    },
  });
  if (!raw) return null;
  return {
    ...raw,
    tuitionFee: raw.tuitionFee ? raw.tuitionFee.toNumber() : null,
  };
}

export async function getSubjectById(
  sid: string,
): Promise<SubjectDetail | null> {
  return db.subject.findUnique({
    where: { id: sid, course: { ...ACTIVE_COURSE } },
    select: {
      id: true,
      courseId: true,
      title: true,
      description: true,
      order: true,
      units: true,
      gender: true,
      createdAt: true,
      updatedAt: true,
      course: {
        select: { title: true },
      },
      lessons: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
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
  });
}

export async function getLessonById(lid: string): Promise<LessonDetail | null> {
  return db.lesson.findUnique({
    where: { id: lid, subject: { course: { ...ACTIVE_COURSE } } },
    select: {
      id: true,
      subjectId: true,
      title: true,
      description: true,
      order: true,
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
  });
}

export async function getTeachers(): Promise<TeacherOption[]> {
  return db.user.findMany({
    where: { role: "TEACHER" },
    orderBy: { lastName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });
}
