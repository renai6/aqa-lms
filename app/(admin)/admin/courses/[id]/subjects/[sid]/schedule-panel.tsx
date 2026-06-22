'use client'

import { useActionState } from 'react'
import { addScheduleAction, removeScheduleAction } from '../../actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ScheduleRow } from '@/lib/courses/queries'
import type { DayOfWeek } from '@prisma/client'

type Props = {
  subjectId: string
  courseId: string
  schedules: ScheduleRow[]
}

const ALL_DAYS: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]

const DAY_ORDER: Record<DayOfWeek, number> = {
  MONDAY: 0,
  TUESDAY: 1,
  WEDNESDAY: 2,
  THURSDAY: 3,
  FRIDAY: 4,
  SATURDAY: 5,
  SUNDAY: 6,
}

const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`
}

function sortedSchedules(schedules: ScheduleRow[]): ScheduleRow[] {
  return [...schedules].sort((a, b) => DAY_ORDER[a.day] - DAY_ORDER[b.day])
}

export function SchedulePanel({ subjectId, courseId, schedules }: Props) {
  const [addState, addFormAction, addPending] = useActionState(addScheduleAction, {
    error: null,
  })
  const [removeState, removeFormAction, removePending] = useActionState(removeScheduleAction, {
    error: null,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No schedule set.</p>
        ) : (
          <ul className="space-y-2">
            {sortedSchedules(schedules).map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span>
                  {DAY_LABELS[s.day]} {formatTime12h(s.startTime)} – {formatTime12h(s.endTime)}
                </span>
                <form action={removeFormAction}>
                  <input type="hidden" name="scheduleId" value={s.id} />
                  <input type="hidden" name="subjectId" value={subjectId} />
                  <input type="hidden" name="courseId" value={courseId} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={removePending}
                    className="text-destructive hover:text-destructive h-7 px-2"
                  >
                    Remove
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={addFormAction} className="space-y-3">
          <input type="hidden" name="subjectId" value={subjectId} />
          <input type="hidden" name="courseId" value={courseId} />
          <div className="space-y-1">
            <Label>Day</Label>
            <Select name="day" required>
              <SelectTrigger>
                <SelectValue placeholder="Select day..." />
              </SelectTrigger>
              <SelectContent>
                {ALL_DAYS.map((day) => (
                  <SelectItem key={day} value={day}>
                    {DAY_LABELS[day]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="sched-start">Start</Label>
              <Input
                id="sched-start"
                name="startTime"
                type="time"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sched-end">End</Label>
              <Input
                id="sched-end"
                name="endTime"
                type="time"
                required
              />
            </div>
          </div>
          {(addState.error || removeState.error) && (
            <p className="text-sm text-destructive">{addState.error ?? removeState.error}</p>
          )}
          <Button type="submit" variant="outline" className="w-full" disabled={addPending}>
            {addPending ? 'Adding...' : 'Add Slot'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
