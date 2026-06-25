import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/admin/page-header'
import { getAdminPurchaseById } from '@/lib/purchases/queries'
import { ProofImage } from './proof-image'
import { ApproveForm } from './approve-form'
import { RejectForm } from './reject-form'

type Props = { params: Promise<{ id: string }> }

export default async function PurchaseDetailPage({ params }: Props) {
  const { id } = await params
  const purchase = await getAdminPurchaseById(id)
  if (!purchase) notFound()

  const isPending = purchase.status === 'PENDING'

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <PageHeader title="Purchase Detail" />

      <div className="rounded-xl border bg-card p-4 space-y-1">
        <div className="flex items-center justify-between">
          <p className="font-semibold">{purchase.student.firstName} {purchase.student.lastName}</p>
          {purchase.status === 'APPROVED' ? <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>
            : purchase.status === 'REJECTED' ? <Badge variant="destructive">Rejected</Badge>
            : <Badge variant="outline">Pending</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{purchase.student.email}</p>
        {purchase.student.contactNumber && <p className="text-sm text-muted-foreground">{purchase.student.contactNumber}</p>}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Courses</p>
        <ul className="divide-y">
          {purchase.courses.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span>{c.title}</span>
              <span className="font-semibold">{c.tuitionFee != null ? `₱${c.tuitionFee.toLocaleString('en-PH')}` : '—'}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">Amount paid ({purchase.paymentType === 'FULL' ? 'Full' : 'Partial'})</span>
          <span className="text-lg font-bold">₱{purchase.amountPaid.toLocaleString('en-PH')}</span>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Proof of payment</p>
        <ProofImage purchaseId={purchase.id} />
      </div>

      {purchase.status === 'REJECTED' && purchase.adminRemarks && (
        <p className="text-sm text-destructive"><strong>Rejection reason:</strong> {purchase.adminRemarks}</p>
      )}

      {isPending && (
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          <ApproveForm id={purchase.id} />
          <div className="border-t pt-4">
            <RejectForm id={purchase.id} />
          </div>
        </div>
      )}
    </div>
  )
}
