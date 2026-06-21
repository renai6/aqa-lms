# Al-Qur'an Academy — LMS & Enrollment Platform

> Project context for Claude Code. This document describes **what** the system is, **how** it is structured, and **the core flows** to implement. Treat inferred sections (data model, routes, directory layout) as starting suggestions derived from the proposal, not hard requirements.

---

## 1. Summary

A centralized **Learning Management System (LMS)** for Al-Qur'an Academy, built as a single full-stack application. It covers three surfaces:

| Surface | Audience | Purpose |
|---|---|---|
| **Public Website** | Prospective students / public | Info, course listings, enrollment, payment instructions |
| **Student Learning Portal** | Enrolled students | Dashboard, courses, materials, recordings, assessments, certificates |
| **Administrative Portal** | Volunteer admins | Approve enrollments, manage courses/assessments, monitor progress, send notifications |

**Design goals:** simplify enrollment, centralize learning materials, automate academic tracking (grading, GWA, certificates), and minimize both administrative workload and infrastructure complexity so non-technical volunteers can maintain it.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | **Next.js** (full-stack: frontend + API routes) |
| Language | **TypeScript** |
| Database | **PostgreSQL** |
| ORM | **Prisma** |
| File / video storage | **Google Drive** (linked, not re-hosted) |
| Transactional email | **Resend** (or equivalent) |
| App hosting | **Vercel** (frontend + serverless API) |
| DB hosting | **Supabase** managed PostgreSQL (or equivalent) |

**Key architectural constraint:** Google Drive is the source of truth for all learning materials and recordings. The LMS only stores **links/metadata** and presents them in a structured UI. Do **not** build file upload/storage for course content — avoid duplicate storage and infra cost. (Proof-of-payment uploads are the exception; see flow below.)

---

## 3. User Roles

- **Guest** — browses public site, submits enrollment form, uploads proof of payment.
- **Student** — created automatically after admin approval; accesses learning portal.
- **Teacher** — assigned to specific subjects via `SubjectTeacher` join table; can grade essay answers for their subjects.
- **Admin** — volunteer; full control over enrollments, courses, assessments, reporting, and notifications.
- **Super Admin** — all Admin capabilities plus user role management.

Auth + role-based access control gate the Student, Teacher, and Admin portals.

---

## 4. Core Flows (study these carefully)

### 4.1 Enrollment & Payment Workflow

Payments are handled **manually** (GCash / bank transfer) — there is **no payment gateway**. The system orchestrates a human-in-the-loop approval flow.

```
1. Student submits enrollment form (public site)
2. System creates an Enrollment Request (status: PENDING)
3. System shows / emails payment instructions (GCash / bank)
4. Student uploads proof of payment (image, max 5MB → Supabase Storage, private)
5. Admin reviews proof and approves (or rejects) enrollment
      ├─ approve ─> status: APPROVED, trigger account creation
      └─ reject  ─> status: REJECTED, notify student
7. System auto-creates Student account (mustChangePassword = true)
8. System emails login credentials to student
9. Student logs in → forced redirect to change-password page
```

**Proof-of-payment storage:** Supabase Storage, private bucket. Only admins can access files via signed URLs. Accepted types: JPG, PNG, WEBP. Max size: 5MB.

**Status machine (suggested):**
`PENDING_PAYMENT → PAYMENT_SUBMITTED → PAYMENT_VERIFIED → APPROVED → ACTIVE`
with `REJECTED` reachable from review steps.

**Why manual payments:** no gateway fees, familiar local methods, full admin control, lower system complexity.

### 4.2 Learning Flow (Student)

```
Login → Dashboard (active courses, progress, upcoming assessments)
      → Open Course → Lessons / Modules
            → View Materials (Google Drive links)
            → Watch Recordings (Google Drive, organized by course/lesson)
            → Take Assessments (quiz / timed exam) → automated scoring
      → Track progress as lessons/assessments complete
      → On course completion → download Certificate (PDF)
```

### 4.3 Course Management Flow (Admin)

```
Create Course → Add Lessons/Modules → Attach Google Drive resources
            → Organize recordings (by course & lesson)
            → Build Assessments (quizzes/exams, question banks, scoring rules)
```

### 4.4 Assessment & Grading Flow

```
Student submits quiz/exam (server validates timing for timed exams)
   → Auto-score objective questions; essays queued for teacher/admin grading
   → Assessment Score (%) = (pointsEarned / totalPoints) × 100
   → Subject Grade (%) = Σ(score × assessment.weight) / Σ(weight)
   → Course Grade (%) = Σ(subjectGrade × subject.units) / Σ(units)
   → GWA = average of all course grades
   → Certificate issued when Course Grade >= course.passingGrade (default 75%)
```

All grade values are stored as percentages (0–100 Float). Weights and passing thresholds are configurable per assessment/subject/course by admins.

### 4.5 Notification Flow (Email)

Transactional emails fire on key events:
- Enrollment received / status updates
- Approval (with login credentials) or rejection
- Account creation
- Certificate issuance

---

## 5. Feature Breakdown by Module

### Public Website
- Academy information pages
- Course listings
- Enrollment form
- Payment instructions (GCash / bank transfer)
- Proof-of-payment upload
- Announcements

### Student Learning Portal
- **Dashboard:** active courses, progress tracking, upcoming assessments
- **Courses:** enrolled courses, lessons & modules, materials & recordings
- **Learning Materials:** Google Drive content surfaced via LMS links
- **Recordings:** Google Drive, organized by course/lesson
- **Assessments:** quizzes, timed exams, automated scoring
- **Profile:** password management, display-name updates
- **Certificates:** downloadable completion certificates

### Administrative Portal
- **Student Management:** review requests, verify payments, approve/reject, manage accounts
- **Course Management:** create courses, manage lessons, attach Drive resources, organize recordings
- **Assessments:** create quizzes/exams, configure scoring rules, manage question banks
- **Progress Monitoring:** performance tracking, completion reports, academic summaries
- **Email Notifications:** enrollment, approval, account creation, certificate issuance

---

## 6. Academic Engine

- **Grade computation:** quiz/exam scoring → subject-level grades → final grade
- **GWA computation:** automatic, with configurable grading rules
- **Reports:** student performance reports, academic summaries, completion tracking
- **Certificates:** automated PDF generation, custom templates per course, downloadable by students, issued on completion

---

## 7. Inferred Data Model (suggested starting point)

> Derived from the proposal — refine during implementation.

- **User** — id, email, passwordHash, role (`SUPER_ADMIN` | `ADMIN` | `TEACHER` | `STUDENT`), firstName, lastName, displayName, isActive, mustChangePassword
- **VerificationToken** — id, userId, token, type (`EMAIL_VERIFICATION` | `PASSWORD_RESET`), expiresAt
- **EnrollmentRequest** — id, applicant info, courseId, status (`PENDING` | `APPROVED` | `REJECTED`), paymentProofUrl (Supabase Storage), adminRemarks, userId (linked on approval)
- **Course** — id, title, description, isPublished, passingGrade (default 75.0%)
- **Subject** — id, courseId, title, description, order, units (default 1)
- **SubjectTeacher** — subjectId, userId (join table for Teacher assignments)
- **Lesson** — id, subjectId, title, description, order, materialUrl, recordingUrl
- **Assessment** — id, subjectId, type (`QUIZ` | `EXAM`), durationMins, passingScore, maxAttempts, weight (default 1.0)
- **Question** — id, assessmentId, questionText, type (`MULTIPLE_CHOICE` | `TRUE_FALSE` | `ESSAY`), points, order
- **QuestionOption** — id, questionId, label, value, isCorrect
- **AssessmentAttempt** — id, assessmentId, userId, status (`IN_PROGRESS` | `SUBMITTED` | `GRADED`), score, startedAt, submittedAt, gradedById, gradedAt
- **StudentAnswer** — id, attemptId, questionId, answer, isCorrect, pointsEarned
- **Enrollment** — id, userId, courseId, progress, enrolledAt, completedAt
- **Grade** — id, userId, subjectId, finalGrade (percentage 0–100)
- **Certificate** — id, userId, courseId, certificateNo, pdfUrl, issuedAt
- **Announcement** — id, title, content, isPublished

---

## 8. Suggested Directory Layout (Next.js App Router)

```
/app
  /(public)        # marketing site, course listings, enrollment form
  /(student)       # student portal (auth-gated, role=STUDENT)
  /(admin)         # admin portal (auth-gated, role=ADMIN)
  /api             # route handlers (enrollment, grading, certs, email, drive)
/lib
  /auth            # session + RBAC
  /grading         # scoring, GWA computation
  /certificates    # PDF generation
  /drive           # Google Drive link helpers
  /email           # Resend wrappers / templates
/prisma
  schema.prisma
/components
```

---

## 9. Development Phases (roadmap)

| Phase | Duration | Scope |
|---|---|---|
| **1 — Foundation** | 2–3 weeks | Auth & roles, public website, enrollment workflow, student & admin base modules |
| **2 — Learning System** | 3–4 weeks | Courses & lessons, Google Drive integration, student dashboard, recording access |
| **3 — Assessments** | 2–3 weeks | Quiz system, exams, grading engine |
| **4 — Reporting & Certification** | 2 weeks | Academic reports, GWA computation, certificate generation, analytics dashboard |

---

## 10. Non-Functional Requirements

- **Maintainability first:** built for non-technical volunteer admins. Favor simple workflows, managed cloud services, and clear documentation.
- **Minimal infra:** no self-hosted file storage for course content; predictable, low cost.
- **Cost (production):** Vercel Pro (~$20/mo) + Supabase Pro (~$25/mo) ≈ **$45/mo (~₱2,700/mo, ₱32,400/yr)**. Free tiers usable during development/pilot; paid plans only needed at production scale. No gateway fees (manual payments).

---

## 11. Implementation Notes & Watch-outs

- **Human-in-the-loop enrollment:** account creation is a *side effect of admin approval*, never automatic on form submission. Keep credential generation + email atomic with approval.
- **Drive integration is link-based:** decide whether to store raw share links or use the Drive API for structured listing; either way, the LMS does not host the files.
- **Credentials over email + forced reset:** admin approval creates account with `mustChangePassword = true`. Student receives credentials by email and is force-redirected to change-password on first login. Uses `VerificationToken` with type `PASSWORD_RESET`.
- **Grading is weight-based percentages:** `Assessment.weight`, `Subject.units`, and `Course.passingGrade` are the only configurable knobs. No rule engine — formula is fixed in `lib/grading/`.
- **Timed exams — server enforces, auto-accept:** `AssessmentAttempt.startedAt` is server-set. On submission, server checks elapsed time. If over limit, submission is **auto-accepted** with whatever answers exist — never rejected. Client timer is display-only.
- **Proof-of-payment uploads:** go to Supabase Storage (private bucket, images only, 5MB max). Access via signed URLs from admin-only API routes.
- **Certificates** are generated PDFs from per-course templates — plan a templating + PDF rendering approach early.

---

*Tip: rename this file to `CLAUDE.md` at the repo root if you want Claude Code to load it automatically as project context.*
