'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

type ProofOfPaymentViewerProps = {
  requestId: string
  hasProof: boolean
}

export function ProofOfPaymentViewer({ requestId, hasProof }: ProofOfPaymentViewerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleView() {
    setError(null)
    setLoading(true)
    const win = window.open('', '_blank')
    try {
      const res = await fetch(`/api/admin/enrollments/${requestId}/proof`)
      if (!res.ok) {
        win?.close()
        throw new Error(`Failed to load proof (${res.status})`)
      }
      const data = await res.json()
      if (!data.signedUrl) {
        win?.close()
        throw new Error('No signed URL returned')
      }
      if (win) {
        win.location.href = data.signedUrl
      } else {
        // Fallback if pop-up was blocked before we could set the URL
        window.open(data.signedUrl, '_blank')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proof of payment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={!hasProof || loading}
        onClick={handleView}
      >
        {loading ? 'Loading...' : 'View Proof of Payment'}
      </Button>
      {!hasProof && (
        <p className="text-xs text-muted-foreground">No proof of payment uploaded.</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
