import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { ensureActiveBatchId } from '@/lib/batches/ensure'
import type { Prisma } from '@prisma/client'

type FakeTx = {
  batch: {
    findFirst: ReturnType<typeof vi.fn>
    aggregate: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
  course: {
    findUnique: ReturnType<typeof vi.fn>
  }
}

let tx: FakeTx

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-15T04:00:00Z'))
  tx = {
    batch: {
      findFirst: vi.fn().mockResolvedValue(null),
      aggregate: vi.fn().mockResolvedValue({ _max: { number: null } }),
      create: vi.fn().mockResolvedValue({ id: 'new-batch' }),
    },
    course: {
      findUnique: vi.fn().mockResolvedValue({ courseAlias: null }),
    },
  }
})

afterEach(() => {
  vi.useRealTimers()
})

const run = (courseId: string) =>
  ensureActiveBatchId(tx as unknown as Prisma.TransactionClient, courseId)

describe('ensureActiveBatchId', () => {
  it('reuses the active batch without creating one', async () => {
    tx.batch.findFirst.mockResolvedValue({ id: 'b1' })

    await expect(run('c1')).resolves.toBe('b1')
    expect(tx.batch.create).not.toHaveBeenCalled()
  })

  // Without this, the enrollment is written with batchId: null and the student
  // never sees a lesson's material, video or recording.
  it('creates the first batch when the course has none', async () => {
    await expect(run('c1')).resolves.toBe('new-batch')
    expect(tx.batch.create).toHaveBeenCalledWith({
      data: { courseId: 'c1', number: 34, isActive: true, name: null },
      select: { id: true },
    })
  })

  // A course whose only batches are closed still needs an open one to enrol
  // into, and it must not collide with a number already taken.
  it('opens the next number when every existing batch is inactive', async () => {
    tx.batch.aggregate.mockResolvedValue({ _max: { number: 35 } })

    await run('c1')
    expect(tx.batch.create).toHaveBeenCalledWith({
      data: { courseId: 'c1', number: 36, isActive: true, name: null },
      select: { id: true },
    })
  })

  // A batch opened by an approval, with no admin present, is named the same
  // way as one an admin starts by hand.
  it('names the batch from the course alias', async () => {
    tx.course.findUnique.mockResolvedValue({ courseAlias: 'MM01' })

    await run('c1')
    expect(tx.batch.create).toHaveBeenCalledWith({
      data: { courseId: 'c1', number: 34, isActive: true, name: '0926MM01' },
      select: { id: true },
    })
  })
})
