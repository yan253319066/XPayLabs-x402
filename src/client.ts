import { x402Client, x402HTTPClient } from '@x402/core/client'
import { wrapFetchWithPayment } from '@x402/fetch'
import { ExactEvmScheme, UptoEvmScheme } from '@x402/evm'
import type { PayResponse, RequestOptions } from './types'
import { Signer } from './types'
import { XPayError } from './error'

export class XPayClient {
  private evmSigner: Awaited<ReturnType<Signer['getClientEvmSigner']>> | null = null
  private fetchWithPayment: ReturnType<typeof wrapFetchWithPayment> | null = null
  private initPromise: Promise<void> | null = null
  private config: { signer: Signer; facilitatorUrl?: string }

  constructor(config: { signer: Signer; facilitatorUrl?: string }) {
    this.config = config
  }

  private async ensureInitialized(): Promise<void> {
    if (this.fetchWithPayment) return
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      try {
        this.evmSigner = await this.config.signer.getClientEvmSigner()
      } catch (err) {
        throw new XPayError(
          `Failed to initialize signer: ${err instanceof Error ? err.message : String(err)}`,
          'INVALID_SIGNER',
        )
      }

      const client = new x402Client()
        .register('eip155:*', new ExactEvmScheme(this.evmSigner!))
        .register('eip155:*', new UptoEvmScheme(this.evmSigner!))

      const httpClient = new x402HTTPClient(client)
      const fetchFn = typeof globalThis !== 'undefined' ? globalThis.fetch : fetch
      this.fetchWithPayment = wrapFetchWithPayment(fetchFn, httpClient)
    })()

    return this.initPromise
  }

  async request<T>(url: string, options: RequestOptions = {}): Promise<PayResponse<T>> {
    await this.ensureInitialized()

    let response: Response
    try {
      response = await this.fetchWithPayment!(url, {
        method: options.method ?? 'GET',
        headers: options.headers as Record<string, string>,
        body: options.body as BodyInit | undefined,
      })
    } catch (err) {
      if (err instanceof XPayError) throw err
      throw new XPayError(
        `Request failed: ${err instanceof Error ? err.message : String(err)}`,
        'NETWORK_ERROR',
      )
    }

    const data: T = await response.json().catch(() => null as unknown as T)

    return {
      data,
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
      headers: response.headers,
      paymentSettled: response.headers.has('x-payment-id'),
    }
  }

  async get<T>(url: string, options?: RequestOptions): Promise<PayResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' })
  }

  async post<T>(url: string, options?: RequestOptions): Promise<PayResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST' })
  }

  async put<T>(url: string, options?: RequestOptions): Promise<PayResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PUT' })
  }

  async delete<T>(url: string, options?: RequestOptions): Promise<PayResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' })
  }
}
