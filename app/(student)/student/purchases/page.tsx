import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getStudentPurchases } from '@/lib/purchases/queries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'My Purchases — AQA' }

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default async function StudentPurchasesPage() {
  const session = await getSession()
  if (!session || session.role !== 'STUDENT') redirect('/login')

  const purchases = await getStudentPurchases(session.userId)

  return (
    <div className="px-6 md:px-10 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My Purchases</h1>
        <Button asChild size="sm"><Link href="/student/courses">Buy more courses</Link></Button>
      </div>

      {purchases.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">You haven&apos;t purchased any courses yet.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {purchases.map((p) => (
            <div key={p.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{dateFmt.format(p.createdAt)}</p>
                {p.status === 'APPROVED' ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>
                ) : p.status === 'REJECTED' ? (
                  <Badge variant="destructive">Rejected</Badge>
                ) : (
                  <Badge variant="outline">Pending review</Badge>
                )}
              </div>
              <ul className="mt-2 list-disc pl-5 text-sm text-foreground">
                {p.courses.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
              <p className="mt-2 text-sm font-semibold">
                ₱{p.amountPaid.toLocaleString('en-PH')}{' '}
                <span className="font-normal text-muted-foreground">({p.paymentType === 'FULL' ? 'Full' : 'Partial'})</span>
              </p>
              {p.status === 'REJECTED' && p.adminRemarks && (
                <p className="mt-2 text-sm text-destructive"><strong>Reason:</strong> {p.adminRemarks}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
