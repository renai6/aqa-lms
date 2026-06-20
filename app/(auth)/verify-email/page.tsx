import Link from 'next/link'
import { db } from '@/lib/db'
import { verifyAndConsumeToken } from '@/lib/auth/tokens'
import { TokenType } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Invalid link</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">This verification link is invalid.</p>
          <p className="mt-4 text-sm text-center">
            <Link href="/login" className="underline underline-offset-4">Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    )
  }

  const userId = await verifyAndConsumeToken(token, TokenType.EMAIL_VERIFICATION)

  if (!userId) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Link expired</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            This verification link has expired or already been used.
          </p>
          <p className="mt-4 text-sm text-center">
            <Link href="/login" className="underline underline-offset-4">Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    )
  }

  await db.user.update({ where: { id: userId }, data: { isActive: true } })

  return (
    <Card className="w-full max-w-sm">
      <CardHeader><CardTitle>Email verified</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Your email has been verified.</p>
        <p className="mt-4 text-sm text-center">
          <Link href="/login" className="underline underline-offset-4">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  )
}
