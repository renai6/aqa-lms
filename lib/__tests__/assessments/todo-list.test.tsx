// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TodoList } from '@/components/student/todo-list'
import type { TodoAssessment } from '@/lib/student/queries'

function item(id: string, overrides: Partial<TodoAssessment> = {}): TodoAssessment {
  return {
    assessmentId: id,
    title: 'Assessment ' + id,
    type: 'EXAM',
    courseId: 'c1',
    subjectId: 's1',
    subjectTitle: 'Fiqh',
    courseTitle: 'Marhala 1',
    inProgress: false,
    ...overrides,
  }
}

describe('TodoList', () => {
  // Not the attempt URL: the launch page carries the timer warning, and
  // linking past it would start the student into a timed exam blind.
  it('links each row to the assessment launch page', () => {
    render(<TodoList items={[item('a1')]} />)
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/student/courses/c1/subjects/s1/assessments/a1',
    )
  })

  it('names the assessment, its course and its subject', () => {
    render(<TodoList items={[item('a1')]} />)
    expect(screen.getByText('Assessment a1')).toBeInTheDocument()
    expect(screen.getByText('Marhala 1 · Fiqh')).toBeInTheDocument()
  })

  it('offers Start for new work and Resume for started work', () => {
    render(
      <TodoList
        items={[item('a1'), item('a2', { type: 'QUIZ', inProgress: true })]}
      />,
    )
    const [fresh, started] = screen.getAllByRole('link')
    expect(fresh).toHaveTextContent('Exam')
    expect(fresh).toHaveTextContent('Start')
    expect(started).toHaveTextContent('Quiz')
    expect(started).toHaveTextContent('Resume')
  })

  it('shows every item when they fit', () => {
    const items = ['1', '2', '3', '4', '5'].map(id => item(id))
    render(<TodoList items={items} />)
    expect(screen.getAllByRole('link')).toHaveLength(5)
    expect(screen.queryByText(/more in your courses/)).toBeNull()
  })

  // A silent cap would be the original bug again: work that exists but does
  // not show.
  it('says how many are hidden past the cap', () => {
    const items = ['1', '2', '3', '4', '5', '6', '7'].map(id => item(id))
    render(<TodoList items={items} />)
    expect(screen.getAllByRole('link')).toHaveLength(5)
    expect(screen.getByText('+2 more in your courses')).toBeInTheDocument()
  })
})
