import { describe, it, expect } from 'vitest'
import { registerSchema, createPurchaseSchema } from '@/lib/purchases/schema'

const validRegister = {
  firstName: 'Juan',
  lastName: 'dela Cruz',
  email: 'juan@example.com',
  password: 'Password123',
  confirmPassword: 'Password123',
  gender: 'MALE',
  address: '123 Main St',
  contactNumber: '09171234567',
  facebookName: 'Juan dela Cruz',
  facebookLink: 'https://facebook.com/juan',
  studentType: 'NEW',
}

describe('registerSchema', () => {
  it('accepts valid input', () => {
    expect(registerSchema.safeParse(validRegister).success).toBe(true)
  })
  it('rejects mismatched passwords', () => {
    const r = registerSchema.safeParse({ ...validRegister, confirmPassword: 'nope' })
    expect(r.success).toBe(false)
  })
  it('rejects a short password', () => {
    const r = registerSchema.safeParse({ ...validRegister, password: 'a1', confirmPassword: 'a1' })
    expect(r.success).toBe(false)
  })
  it('rejects an invalid PH mobile number', () => {
    const r = registerSchema.safeParse({ ...validRegister, contactNumber: '12345' })
    expect(r.success).toBe(false)
  })
  it('rejects a non-https facebook link', () => {
    const r = registerSchema.safeParse({ ...validRegister, facebookLink: 'http://facebook.com/x' })
    expect(r.success).toBe(false)
  })
})

describe('createPurchaseSchema', () => {
  const base = {
    courseIds: ['c1', 'c2'],
    paymentType: 'FULL',
    amountPaid: 5000,
    studentType: 'OLD',
  }
  it('accepts a valid OLD-student partial purchase', () => {
    const r = createPurchaseSchema.safeParse({ ...base, paymentType: 'PARTIAL', amountPaid: 1000 })
    expect(r.success).toBe(true)
  })
  it('requires at least one course', () => {
    const r = createPurchaseSchema.safeParse({ ...base, courseIds: [] })
    expect(r.success).toBe(false)
  })
  it('rejects amountPaid <= 0', () => {
    const r = createPurchaseSchema.safeParse({ ...base, amountPaid: 0 })
    expect(r.success).toBe(false)
  })
  it('forces NEW students to pay in full', () => {
    const r = createPurchaseSchema.safeParse({ ...base, studentType: 'NEW', paymentType: 'PARTIAL' })
    expect(r.success).toBe(false)
  })
})
