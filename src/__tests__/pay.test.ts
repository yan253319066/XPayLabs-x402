import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pay } from '../pay'
import { XPayError } from '../error'
import { Signer } from '../types'
import type { ClientEvmSigner } from '@x402/evm'

const mockSigner = new Signer({
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  signTypedData: vi.fn(),
} as unknown as ClientEvmSigner)

describe('pay', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('throws INVALID_SIGNER when signer has no address', async () => {
    const badSigner = new Signer({} as unknown as ClientEvmSigner)
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
    expect(result.response.ok).toBe(true)
    expect(result.response.status).toBe(200)
    expect(result.data).toEqual(responseBody)
    expect(result.paymentId).toBeUndefined()
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
      request: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'hello' }),
      },
    })

    expect(capturedRequest!.method).toBe('POST')
    expect(capturedRequest!.headers.get('Content-Type')).toBe('application/json')
    vi.unstubAllGlobals()
  })

  it('uses custom fetchFn', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: new Headers() }),
    )

    const result = await pay('https://example.com/api', { signer: mockSigner, fetchFn })
    expect(result.data).toEqual({ ok: true })
    expect(fetchFn).toHaveBeenCalled()
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

  it('throws HOOK_ABORTED when onBeforePayment aborts', async () => {
    const paymentBody = {
      x402Version: 1,
      accepts: [{
        scheme: 'exact',
        network: 'eip155:84532',
        maxAmountRequired: '100000',
        resource: 'https://example.com/api',
        description: 'API access',
        payTo: '0xA0b86991c6218b363c1dD23eF78c7c555b944437',
        maxTimeoutSeconds: 3600,
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      }],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(paymentBody), { status: 402, headers: new Headers() }),
      ),
    )

    await expect(
      pay('https://example.com/api', {
        signer: mockSigner,
        hooks: {
          onBeforePayment: () => Promise.resolve({ abort: true, reason: 'user cancelled' }),
        },
      }),
    ).rejects.toMatchObject({ code: 'HOOK_ABORTED' })

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
