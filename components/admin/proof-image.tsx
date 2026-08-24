"use client";

import { useEffect, useState } from "react";

// Fetches a short-lived signed URL from an admin proof route and renders it.
// `src` is the route to call, so purchases and payments share one component.
export function ProofImage({ src }: { src: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(src)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (active) setUrl(d.signedUrl);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [src]);

  if (error)
    return (
      <p className="text-muted-foreground text-sm">
        Could not load proof image.
      </p>
    );
  if (!url) return <div className="bg-muted h-48 animate-pulse rounded-lg" />;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img src={url} alt="Payment proof" className="max-h-96 rounded-lg border" />
  );
}
