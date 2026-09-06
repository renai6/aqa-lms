// BatchRecording.date is a @db.Date, so Prisma hands it back as UTC midnight.
// Formatting in the viewer's local zone would show Sep 6 as Sep 5 for anyone
// behind UTC, so the timezone is pinned.
export function formatRecordingDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// A recording is usually the only one on its date, so the date alone names it.
// A title takes over when an admin has something more specific to say.
export function recordingLabel(recording: { title: string | null; date: Date }): string {
  const title = recording.title?.trim()
  return title ? title : formatRecordingDate(recording.date)
}
