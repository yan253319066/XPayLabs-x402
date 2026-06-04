import { describe, it, expect } from 'vitest'
import { XPayError } from '../error'

describe('XPayError', () => {
  it('creates error with correct name', () => {
    const error = new XPayError('test', 'PAYMENT_FAILED')
    expect(error.name).toBe('XPayError')
    expect(error.message).toBe('test')
  })

  it('has all error codes', () => {
    const codes = ['UNSUPPORTED_CHAIN', 'INVALID_SIGNER', 'PAYMENT_FAILED', 'NETWORK_ERROR'] as const
    for (const code of codes) {
      const error = new XPayError(code, code)
      expect(error.code).toBe(code)
    }
  })

  it('is instance of Error', () => {
    const error = new XPayError('test', 'PAYMENT_FAILED')
    expect(error).toBeInstanceOf(Error)
  })
})
