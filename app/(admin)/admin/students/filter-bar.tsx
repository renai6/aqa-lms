// app/(admin)/admin/students/filter-bar.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download } from 'lucide-react'

type Course = { id: string; title: string }

type Props = {
  courses: Course[]
  currentCourse?: string
  currentGender?: string
  exportHref: string
}

export function FilterBar({ courses, currentCourse, currentGender, exportHref }: Props) {
  const router = useRouter()

  function handleChange(key: string, value: string) {
    const params = new URLSearchParams()
    if (key !== 'course' && currentCourse) params.set('course', currentCourse)
    if (key !== 'gender' && currentGender) params.set('gender', currentGender)
    if (value) params.set(key, value)
    router.push('/admin/students' + (params.size ? '?' + params.toString() : ''))
  }

  const hasFilters = currentCourse || currentGender

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select
        value={currentCourse ?? ''}
        onChange={(e) => handleChange('course', e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All courses</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>{c.title}</option>
        ))}
      </select>

      <select
        value={currentGender ?? ''}
        onChange={(e) => handleChange('gender', e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All genders</option>
        <option value="MALE">Male</option>
        <option value="FEMALE">Female</option>
      </select>

      {hasFilters && (
        <Link
          href="/admin/students"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear filters
        </Link>
      )}

      <a
        href={exportHref}
        className="ml-auto flex items-center gap-1.5 h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-muted transition-colors"
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        Export CSV
      </a>
    </div>
  )
}
