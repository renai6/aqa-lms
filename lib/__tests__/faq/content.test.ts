import { describe, it, expect } from 'vitest'
import { FAQ_CATEGORIES, faqJsonLd } from '@/lib/faq/content'

const items = FAQ_CATEGORIES.flatMap((c) => c.items)

describe('FAQ_CATEGORIES', () => {
  it('has no empty category', () => {
    expect(FAQ_CATEGORIES.length).toBeGreaterThan(0)
    for (const category of FAQ_CATEGORIES) {
      expect(category.items.length, category.title).toBeGreaterThan(0)
    }
  })

  it('uses unique category ids, since they are page anchors', () => {
    const ids = FAQ_CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never repeats a question', () => {
    const questions = items.map((i) => i.question)
    expect(new Set(questions).size).toBe(questions.length)
  })

  it('phrases every entry as a question with a written answer', () => {
    for (const item of items) {
      expect(item.question.endsWith('?'), item.question).toBe(true)
      expect(item.answer.length, item.question).toBeGreaterThan(0)
      for (const paragraph of item.answer) {
        expect(paragraph.trim(), item.question).not.toBe('')
      }
    }
  })

  it('uses plain dashes only', () => {
    expect(JSON.stringify(FAQ_CATEGORIES)).not.toMatch(/[–—]/)
  })

  // The account numbers are only shown after login, at checkout.
  it('keeps the payment account numbers off the public page', () => {
    expect(JSON.stringify(FAQ_CATEGORIES)).not.toMatch(/\d{10,}/)
  })
})

describe('faqJsonLd', () => {
  it('lists every question once as schema.org FAQPage data', () => {
    const data = faqJsonLd()
    expect(data['@type']).toBe('FAQPage')
    expect(data.mainEntity).toHaveLength(items.length)
    expect(data.mainEntity[0]).toEqual({
      '@type': 'Question',
      name: items[0].question,
      acceptedAnswer: { '@type': 'Answer', text: items[0].answer.join(' ') },
    })
  })
})
