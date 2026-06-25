'use client'

import { useEffect, useState } from 'react'

export function ProofImage({ purchaseId }: { purchaseId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    fetch(`/api/admin/purchases/${purchaseId}/proof`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (active) setUrl(d.signedUrl) })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [purchaseId])

  if (error) return <p className="text-sm text-muted-foreground">Could not load proof image.</p>
  if (!url) return <div className="h-48 animate-pulse rounded-lg bg-muted" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Payment proof" className="max-h-96 rounded-lg border" />
}
