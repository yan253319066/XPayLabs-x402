import { describe, it, expect, vi, beforeEach } from 'vitest'
import { XPayClient } from '../client'
import { XPayError } from '../error'
import { Signer } from '../types'
import type { ClientEvmSigner } from '@x402/evm'

const mockSigner = new Signer(() =>
  Promise.resolve({
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    signTypedData: vi.fn(),
  } as unknown as ClientEvmSigner),
)

describe('XPayClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('constructs with a signer', () => {
    const client = new XPayClient({ signer: mockSigner })
    expect(client).toBeInstanceOf(XPayClient)
  })

  it('throws INVALID_SIGNER if signer init fails', async () => {
    const badSigner = new Signer(() => Promise.reject(new Error('bad')))
    const client = new XPayClient({ signer: badSigner })
    await expect(client.get('https://example.com/api')).rejects.toThrow(XPayError)
    await expect(client.get('https://example.com/api')).rejects.toMatchObject({ code: 'INVALID_SIGNER' })
  })

  it('returns data on GET', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ users: [] }), {
          status: 200,
          headers: new Headers(),
        }),
      ),
    )

    const client = new XPayClient({ signer: mockSigner })
    const result = await client.get('https://example.com/users')
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ users: [] })

    vi.unstubAllGlobals()
  })

  it('returns data on POST', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: 1 }), {
          status: 201,
          headers: new Headers(),
        }),
      ),
    )

    const client = new XPayClient({ signer: mockSigner })
    const result = await client.post('https://example.com/users', {
      body: JSON.stringify({ name: 'test' }),
    })
    expect(result.status).toBe(201)
    expect(result.data).toEqual({ id: 1 })

    vi.unstubAllGlobals()
  })

  it('detects paymentSettled from header', async () => {
    const headers = new Headers({ 'x-payment-id': 'tx_123' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200, headers }),
      ),
    )

    const client = new XPayClient({ signer: mockSigner })
    const result = await client.get('https://example.com/paid')
    expect(result.paymentSettled).toBe(true)

    vi.unstubAllGlobals()
  })

  it('reuses the same x402 client across requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: new Headers() }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = new XPayClient({ signer: mockSigner })
    await client.get('https://example.com/a')
    await client.get('https://example.com/b')

    expect(fetchMock).toHaveBeenCalledTimes(2)

    vi.unstubAllGlobals()
  })
})
