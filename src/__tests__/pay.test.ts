import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pay } from '../pay'
import { XPayError } from '../error'
import { Signer } from '../types'
import type { ClientEvmSigner } from '@x402/evm'

const mockSigner = new Signer(() =>
  Promise.resolve({
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    signTypedData: vi.fn(),
  } as unknown as ClientEvmSigner),
)

describe('pay', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('throws INVALID_SIGNER when signer init fails', async () => {
    const badSigner = new Signer(() => Promise.reject(new Error('wallet locked')))
    await expect(pay('https://example.com/api', { signer: badSigner })).rejects.toThrow(XPayError)
    await expect(pay('https://example.com/api', { signer: badSigner })).rejects.toMatchObject({
      code: 'INVALID_SIGNER',
    })
  })

  it('throws NETWORK_ERROR on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')))
    await expect(pay('https://example.com/api', { signer: mockSigner })).rejects.toThrow(XPayError)
    await expect(pay('https://example.com/api', { signer: mockSigner })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
    vi.unstubAllGlobals()
  })

  it('returns PayResponse on successful non-402 response', async () => {
    const responseBody = { result: 'ok' }
    const headers = new Headers({ 'content-type': 'application/json' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(responseBody), {
          status: 200,
          statusText: 'OK',
          headers,
        }),
      ),
    )

    const result = await pay('https://example.com/api', { signer: mockSigner })
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(result.data).toEqual(responseBody)
    expect(result.paymentSettled).toBe(false)
    vi.unstubAllGlobals()
  })

  it('uses custom method and headers', async () => {
    let capturedRequest: Request | null = null
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      capturedRequest = input instanceof Request ? input : new Request(input)
      return Promise.resolve(
        new Response(JSON.stringify({}), { status: 200, headers: new Headers() }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    await pay('https://example.com/api', {
      signer: mockSigner,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'hello' }),
    })

    expect(capturedRequest!.method).toBe('POST')
    expect(capturedRequest!.headers.get('Content-Type')).toBe('application/json')
    vi.unstubAllGlobals()
  })

  it('returns null data on non-JSON response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('not json', { status: 200, headers: new Headers() }),
      ),
    )

    const result = await pay('https://example.com/api', { signer: mockSigner })
    expect(result.data).toBeNull()
    vi.unstubAllGlobals()
  })

  it('calls onAfterPayment when x-payment-id header present', async () => {
    const headers = new Headers({ 'x-payment-id': 'tx_abc' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200, headers }),
      ),
    )

    const onAfterPayment = vi.fn()
    await pay('https://example.com/api', {
      signer: mockSigner,
      hooks: { onAfterPayment },
    })
    expect(onAfterPayment).toHaveBeenCalledWith({ transaction: 'tx_abc' })
    vi.unstubAllGlobals()
  })

  it('calls onAfterPayment without transaction when header missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200, headers: new Headers() }),
      ),
    )

    const onAfterPayment = vi.fn()
    await pay('https://example.com/api', {
      signer: mockSigner,
      hooks: { onAfterPayment },
    })
    expect(onAfterPayment).toHaveBeenCalledWith({ transaction: undefined })
    vi.unstubAllGlobals()
  })
})
