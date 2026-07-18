import { db } from '@/lib/db'
import { generateCertificateNo } from '@/lib/certificates/number'

// Idempotent auto-issue: one certificate per student per course. Reuses the
// existing row (keeping its number and date stable) or creates a new one.
export async function issueCertificate(
  userId: string,
  courseId: string,
): Promise<{ certificateNo: string; issuedAt: Date }> {
  return db.certificate.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: {},
    create: { userId, courseId, certificateNo: generateCertificateNo() },
    select: { certificateNo: true, issuedAt: true },
  })
}
