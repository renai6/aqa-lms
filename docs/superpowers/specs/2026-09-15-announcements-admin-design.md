# Announcements Admin Design

The `Announcement` table and a student dashboard section that reads it have existed since the June dashboard redesign.
Nothing in the app creates, edits, publishes or deletes an announcement, so the table is empty and students never see the section.
The dashboard also cuts the list to 3 with no way to reach the rest, and every announcement goes to every student.

This design gives admins a place to manage announcements, lets an announcement target specific courses, adds one optional image, and gives students a page that shows every announcement in full.

## Goals

- An admin creates, edits, publishes, unpublishes, pins and deletes announcements from the admin panel.
- An announcement goes to everyone, or only to students enrolled in selected courses.
Picking a course group (for example "Marhala") selects all of its current levels.
- An announcement can carry one optional image.
- A student sees every announcement meant for them, with full text and image, not only the latest 3.
- Existing rows keep working: they become "everyone" announcements.

## Non-goals

- No announcements on the public site, although `PROJECT_SPEC.md` lists them there.
- No email or push notifications, and no unread or "new" markers.
- No teacher authoring.
Admins only (ADMIN and SUPER_ADMIN).
- No gender filter.
- No batch targeting.
Batches are short-lived and numerous; courses and groups cover the real use cases.
- No scheduled publishing and no expiry date.
- No rich text, no links rendered as anchors, and no more than one image.
- No pagination on the student page.
Volume is a handful of announcements a month; revisit if that changes.
- No mobile navigation menu for students.
All student nav links are already `hidden sm:block`, so phones have no nav links today.
That is a pre-existing gap and out of scope here; on phones the dashboard's "View all" link reaches the new page.

## Data model

```prisma
enum AnnouncementAudience {
  EVERYONE
  COURSES
}

model Announcement {
  id String @id @default(cuid())

  title    String
  content  String
  imageUrl String?

  // EVERYONE ignores `courses`. COURSES reaches only students actively
  // enrolled in one of `courses`. Kept separate from the join rows so a
  // targeted announcement that loses its courses never widens to everyone.
  audience AnnouncementAudience @default(EVERYONE)

  isPublished Boolean   @default(false)
  // Set on the first publish and never cleared, so unpublishing to fix a
  // typo and publishing again does not jump the announcement back to the top.
  publishedAt DateTime?
  isPinned    Boolean   @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  courses AnnouncementCourse[]
}

model AnnouncementCourse {
  announcementId String
  announcement   Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)
  courseId       String
  course         Course       @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@id([announcementId, courseId])
  @@index([courseId])
}
```

`Course` gains the back-relation `announcements AnnouncementCourse[]`.

The migration is additive.
Existing rows get `audience = EVERYONE` from the default.
Existing published rows get `publishedAt = createdAt` in the same migration, so their order does not change.

### Why selected courses, not group names

The audience is stored as the concrete courses, even when the admin picked a whole group.
A group is only a shared `groupName` string on `Course`, so storing the group name would mean renaming a group silently empties the audience of every announcement that used the old name.
The cost is that a level added to a group later is not included in older announcements for that group.
New levels are rare, and an announcement is about the levels that exist when it is posted.

## Who sees an announcement

A student sees an announcement when it is published and either:

- its audience is `EVERYONE`, or
- its audience is `COURSES` and at least one of its courses is not archived and has an enrollment for the student that is not removed.

The rule is one Prisma `where`, reusing the existing filters so archive and removal rules stay in one place:

```ts
{
  isPublished: true,
  OR: [
    { audience: 'EVERYONE' },
    {
      courses: {
        some: {
          course: {
            ...ACTIVE_COURSE,
            enrollments: { some: { userId, ...ACTIVE_ENROLLMENT } },
          },
        },
      },
    },
  ],
}
```

Order is `isPinned desc, publishedAt desc`.

Consequences, stated so nobody is surprised:

- A student whose purchase is still pending has no enrollment yet, so they see only `EVERYONE` announcements.
- A student removed from a course stops seeing that course's announcements.
- An announcement whose every course is archived reaches no students.
It stays visible to admins.

## Admin side

### Navigation

A new "Announcements" item with the lucide `Megaphone` icon in `app/(admin)/layout.tsx`, between Courses and the disabled Reports item.

### List: `/admin/announcements`

A table page styled like `/admin/courses`, with a "New announcement" button.

| Column | Content |
| --- | --- |
| Title | Links to the edit page |
| Audience | "Everyone", or course titles joined with commas, cut to the first 2 plus "+N more" |
| Status | Published or Draft badge |
| Pinned | Pin icon when pinned |
| Published | `publishedAt` date, or a dash for a never-published draft |

Order is `isPinned desc, updatedAt desc`, so pinned first and then the most recently worked on.
All announcements are listed, drafts included.
An empty state explains that there are no announcements yet and links to "New announcement".

### Form: `/admin/announcements/new` and `/admin/announcements/[id]`

One shared form component.

- **Title:** required, trimmed, at most 200 characters.
- **Content:** required, trimmed, at most 5,000 characters, plain text.
Rendered with `whitespace-pre-line` so line breaks survive.
React escapes it, so there is no HTML to sanitize.
- **Image:** optional file input (JPG, PNG, WEBP, at most 10 MB) with a preview of the chosen file.
On the edit page, the current image is shown with a "Remove image" checkbox.
Choosing a new file replaces the current image.
- **Audience:** radio "Everyone" or "Specific courses".
"Specific courses" reveals a checklist of courses:
  - Courses sharing a `groupName` sit under a group checkbox, ordered by `level`.
  Ticking the group ticks every level; the group box is indeterminate when only some are ticked.
  - Courses without a group are listed on their own, ordered by title.
  - Archived courses are not offered, except an archived course already attached to this announcement, which is shown ticked with an "Archived" label so the admin can see and untick it.
- **Pin to top:** checkbox.

Buttons depend on the state:

| Page | Buttons |
| --- | --- |
| New | "Save draft", "Publish" |
| Edit, draft | "Save draft", "Publish", "Delete" |
| Edit, published | "Save changes", "Unpublish", "Delete" |

The submit buttons send one form with an `intent` field (`save`, `publish`, `unpublish`), so a single action handles content and status together and the admin never has to save and then publish separately.
"Delete" opens a confirmation dialog like `delete-subject-button.tsx`.
After create, the admin lands on the edit page with a success toast; after delete, on the list.

### Server actions: `lib/announcements/actions.ts`

Kept in `lib/` like `lib/batches/actions.ts`, so the unit tests import them directly.

- `saveAnnouncementAction(prev, formData)` creates or updates, depending on whether `id` is present.
- `deleteAnnouncementAction(prev, formData)`.

Every action:

1. Checks the session role is ADMIN or SUPER_ADMIN, returning `Unauthorized` or `Forbidden` like the course actions.
2. Validates with Zod.
`audience = COURSES` needs at least one course id.
Every course id must exist and be either not archived or already attached to this announcement.
3. Revalidates `/admin/announcements`, the edit page, `/student/dashboard` and `/student/announcements`.

`publishedAt` is set only when `intent = publish` and `publishedAt` is null.
`intent = unpublish` sets `isPublished = false` and leaves `publishedAt` alone.

Updating replaces the course list inside one `$transaction`: delete the announcement's `AnnouncementCourse` rows, update the announcement, create the new rows.
Switching to `EVERYONE` clears the rows.

### Images

Images reuse the course images bucket (`SUPABASE_COURSE_IMAGES_BUCKET`, already public and already allowed by `next.config.ts` `images.remotePatterns`).
Each upload is stored at `announcements/{randomUUID}.{ext}`.
A fresh name per upload means a replaced image never shows a stale cached copy, and the create flow does not need the row id before uploading.
Validation uses the existing `validateImageUpload` in `lib/uploads/image.ts`.

`lib/announcements/image.ts` holds the storage helpers: upload returning the public URL, remove by public URL, and a pure `storagePathFromPublicUrl` that maps a public URL back to its object path.

Order of operations on save, so a failure never leaves the row pointing at a missing file:

1. Validate the form and the file.
2. Upload the new file, if any.
3. Write the database.
If that fails, remove the file just uploaded and return the error.
4. Only after the write succeeds, remove the old file when it was replaced or removed.
If that removal fails, log it and still report success; an orphaned file is harmless, a broken image is not.

Delete removes the row first, then the image file, with the same log-and-continue rule.

## Student side

### Queries: `lib/announcements/queries.ts`

- `getStudentAnnouncements(userId, { take? })` applies the visibility rule above and returns `id, title, content, imageUrl, isPinned, publishedAt`.
- `getAdminAnnouncements()` for the list, with course titles.
- `getAnnouncementForEdit(id)` with attached course ids and their archived state.
- `getAnnouncementCourseOptions()` for the picker: active courses with `groupName` and `level`.

`getStudentDashboard` stops querying announcements itself and calls `getStudentAnnouncements(userId, { take: 4 })`.
`DashboardAnnouncement` becomes the shape above, replacing `createdAt` with `publishedAt`.

### Dashboard

The section shows the first 3, as today, with a small thumbnail on the right when there is an image and a pin marker when pinned.
The date is shown as `publishedAt`.
When the query returned 4, a "View all" link to `/student/announcements` sits in the section header.
The section is still hidden when there are none.

### Page: `/student/announcements`

Every visible announcement, pinned first, as full cards: title, pin marker, published date, the image at full width (`next/image`, natural aspect ratio), and the full content.
An empty state says there are no announcements yet.
The student nav gets an "Announcements" link between Dashboard and Courses.
The page follows the student layout and must look right at phone width.

## Testing

Unit tests in `lib/__tests__/announcements/`, mocking `@/lib/db`, `@/lib/auth/session`, `next/cache` and the storage helpers the way existing action tests do:

- **Access:** no session and non-admin roles are rejected, and nothing is written.
- **Validation:** missing or too-long title and content; `COURSES` with no courses; an unknown course id; a newly added archived course is rejected while an already attached archived course is accepted.
- **Publishing:** first publish sets `publishedAt`; unpublish then publish keeps the original date; saving a draft never sets it.
- **Courses:** update replaces the rows in one transaction; switching to `EVERYONE` clears them.
- **Images:** a failed database write removes the just-uploaded file; the old file is removed only after a successful write; a failed old-file removal still returns success; "Remove image" clears `imageUrl` and removes the file; delete removes the file after the row.
- **Visibility:** `getStudentAnnouncements` builds the `where` and `orderBy` above, including `ACTIVE_COURSE` and `ACTIVE_ENROLLMENT`.
- **`storagePathFromPublicUrl`:** a bucket URL maps to its object path; a foreign URL returns null.

End to end, in a real browser against the dev server, on desktop and at phone width:

1. As an admin, create a draft for the Marhala group with an image, and confirm no student sees it.
2. Publish it; a student enrolled in a Marhala level sees it on the dashboard and the announcements page, and a student in another course does not.
3. Create an "everyone" announcement and pin it; both students see it first.
4. Unpublish and republish the first one; its date and position do not change.
5. Replace the image, then remove it; the student view updates and nothing renders broken.
6. Create 4 visible announcements; the dashboard shows 3 and "View all".
7. Delete an announcement; it disappears everywhere.

The migration needs one hand-written statement, so it is created in two steps.
The user runs `pnpm prisma migrate dev --create-only --name announcements_admin` in their own terminal.
The `UPDATE "Announcement" SET "publishedAt" = "createdAt" WHERE "isPublished"` statement is appended to the generated SQL.
The user then runs `pnpm prisma migrate dev` to apply it.
A read-only script against the real client confirms the new columns and the `AnnouncementCourse` table exist.
