const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_SIZE = 5 * 1024 * 1024

export type ImageValidationResult =
  | { ok: true; buffer: Buffer; ext: string; contentType: string }
  | { ok: false; error: string }

export async function validateImageUpload(file: unknown): Promise<ImageValidationResult> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Please select a file to upload.' }
  }
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return { ok: false, error: 'Only JPG, PNG, and WEBP images are accepted.' }
  }
  if (file.size > MAX_SIZE) {
    return { ok: false, error: 'File size must be 5MB or less.' }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const h = new Uint8Array(buffer.subarray(0, 12))
  const isJpeg = h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff
  const isPng = h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47
  const isWebp =
    h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46 &&
    h[8] === 0x57 && h[9] === 0x45 && h[10] === 0x42 && h[11] === 0x50
  if (!isJpeg && !isPng && !isWebp) {
    return { ok: false, error: 'Invalid image file. Only JPG, PNG, and WEBP images are accepted.' }
  }

  return { ok: true, buffer, ext: EXT[file.type], contentType: file.type }
}
