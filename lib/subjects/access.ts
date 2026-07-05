// Database-aware helpers for subject gender access. Separate from the pure
// `visibility.ts` so the predicate can be unit-tested without the db client.
import { db } from "@/lib/db";
import type { Gender } from "@prisma/client";

// The viewer's gender, or null when unknown (legacy rows / missing user).
export async function getUserGender(userId: string): Promise<Gender | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { gender: true },
  });
  return user?.gender ?? null;
}
