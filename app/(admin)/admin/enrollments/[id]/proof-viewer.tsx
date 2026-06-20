'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

type ProofOfPaymentViewerProps = {
  requestId: string
  hasProof: boolean
}

export function ProofOfPaymentViewer({ requestId, hasProof }: ProofOfPaymentViewerProps) {
  const [loading, setLoading] = useState(false)

  async function handleView() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/enrollments/${requestId}/proof`)
      const { signedUrl } = await res.json()
      window.open(signedUrl, '_blank')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={!hasProof || loading}
      onClick={handleView}
      className="w-full"
    >
      {loading ? 'Loading...' : 'View Proof of Payment'}
    </Button>
  )
}
