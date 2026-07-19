export function toPreviewUrl(url: string): string | null {
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (!match) return null
  return `https://drive.google.com/file/d/${match[1]}/preview`
}
