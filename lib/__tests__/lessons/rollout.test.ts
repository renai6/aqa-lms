import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    course: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
    lessonCompletion: { findMany: vi.fn() },
    assessmentAttempt: { findMany: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { countStudentsAffectedByGating } from '@/lib/lessons/queries'

describe('countStudentsAffectedByGating', () => {
  beforeEach(() => vi.clearAllMocks())

  it('counts only students who would have a lesson locked', async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue({
      subjects: [
        {
          lessons: [
            {
              id: 'l1',
              order: 1,
              assessment: { id: 'a1', isPublished: true, passingScore: 75 },
            },
            { id: 'l2', order: 2, assessment: null },
          ],
        },
      ],
    } as never)
    vi.mocked(db.enrollment.findMany).mockResolvedValue([
      { userId: 'passed' },
      { userId: 'stuck' },
    ] as never)
    // "passed" already marked lesson 1 done before gating existed.
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([
      { userId: 'passed', lessonId: 'l1' },
    ] as never)
    vi.mocked(db.assessmentAttempt.findMany).mockResolvedValue([] as never)

    expect(await countStudentsAffectedByGating('course1')).toBe(1)
  })

  it('returns 0 when the course has no published gates', async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue({
      subjects: [{ lessons: [{ id: 'l1', order: 1, assessment: null }] }],
    } as never)
    vi.mocked(db.enrollment.findMany).mockResolvedValue([{ userId: 'u1' }] as never)
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([] as never)
    vi.mocked(db.assessmentAttempt.findMany).mockResolvedValue([] as never)

    expect(await countStudentsAffectedByGating('course1')).toBe(0)
  })

  // Single-gate fixture shared by the attemptScores boundary tests below. A
  // second, ungated lesson is required: computeLockedLessons never locks the
  // blocking lesson itself (the student must be able to reach it to take the
  // quiz), so a gate on the only lesson in a course can never produce a
  // locked lesson no matter the score. l2 is what actually gets locked when
  // l1's gate is unsatisfied.
  //
  // Every test pairs the student under test with an "anchor" student who has
  // no completion and no attempt at all, so is unconditionally counted.
  // Pinning the total to exactly 1 (anchor only) or 2 (anchor + case student)
  // isolates the case student's status precisely, rather than mixing two case
  // students together where a permutation of a key-mismatch bug could
  // coincidentally leave the total unchanged.
  const gatedCourse = {
    subjects: [
      {
        lessons: [
          {
            id: 'l1',
            order: 1,
            assessment: { id: 'a1', isPublished: true, passingScore: 70 },
          },
          { id: 'l2', order: 2, assessment: null },
        ],
      },
    ],
  }

  it('does not count a student with a passing attempt and no completion', async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue(gatedCourse as never)
    vi.mocked(db.enrollment.findMany).mockResolvedValue([
      { userId: 'passer' },
      { userId: 'anchor' },
    ] as never)
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([] as never)
    vi.mocked(db.assessmentAttempt.findMany).mockResolvedValue([
      { userId: 'passer', assessmentId: 'a1', score: 90 },
    ] as never)

    // Only "anchor" (no attempt at all) should be counted. If "passer"'s
    // attempt were attributed to the wrong user, the total would be 0 or 2.
    expect(await countStudentsAffectedByGating('course1')).toBe(1)
  })

  it('counts a student with a failing attempt and no completion', async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue(gatedCourse as never)
    vi.mocked(db.enrollment.findMany).mockResolvedValue([
      { userId: 'failer' },
      { userId: 'passer' },
    ] as never)
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([] as never)
    vi.mocked(db.assessmentAttempt.findMany).mockResolvedValue([
      { userId: 'failer', assessmentId: 'a1', score: 40 },
      { userId: 'passer', assessmentId: 'a1', score: 95 },
    ] as never)

    // "failer" is locked out, "passer" already cleared the gate.
    expect(await countStudentsAffectedByGating('course1')).toBe(1)
  })

  it('does not count an attempt whose score exactly equals the passing score', async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue(gatedCourse as never)
    vi.mocked(db.enrollment.findMany).mockResolvedValue([
      { userId: 'exact' },
      { userId: 'anchor' },
    ] as never)
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([] as never)
    vi.mocked(db.assessmentAttempt.findMany).mockResolvedValue([
      { userId: 'exact', assessmentId: 'a1', score: 70 },
    ] as never)

    // The rule is "at or above": a score equal to passingScore satisfies the
    // gate, so only "anchor" should be counted.
    expect(await countStudentsAffectedByGating('course1')).toBe(1)
  })

  it('counts a student whose attempt score is null, awaiting grading', async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue(gatedCourse as never)
    vi.mocked(db.enrollment.findMany).mockResolvedValue([
      { userId: 'pending' },
      { userId: 'passer' },
    ] as never)
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([] as never)
    vi.mocked(db.assessmentAttempt.findMany).mockResolvedValue([
      { userId: 'pending', assessmentId: 'a1', score: null },
      { userId: 'passer', assessmentId: 'a1', score: 90 },
    ] as never)

    // A null score never satisfies a gate, so "pending" is still locked out
    // while "passer" is not.
    expect(await countStudentsAffectedByGating('course1')).toBe(1)
  })
})
