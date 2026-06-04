import { x402Client, x402HTTPClient } from '@x402/core/client'
import { wrapFetchWithPayment } from '@x402/fetch'
import { ExactEvmScheme, UptoEvmScheme } from '@x402/evm'
import type { PayResponse, RequestOptions, PayOptions } from './types'
import { Signer } from './types'
import { XPayError } from './error'

export class XPayClient {
  private evmSigner: Awaited<ReturnType<Signer['getClientEvmSigner']>> | null = null
  private x402: x402Client | null = null
  private baseFetchWithPayment: ReturnType<typeof wrapFetchWithPayment> | null = null
  private initPromise: Promise<void> | null = null
  private signer: Signer

  constructor(config: { signer: Signer }) {
    this.signer = config.signer
  }

  private async ensureInitialized(): Promise<void> {
    if (this.x402) return
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      try {
        this.evmSigner = await this.signer.getClientEvmSigner()
      } catch (err) {
        throw new XPayError(
          `Failed to initialize signer: ${err instanceof Error ? err.message : String(err)}`,
          'INVALID_SIGNER',
        )
      }

      this.x402 = new x402Client()
        .register('eip155:*', new ExactEvmScheme(this.evmSigner!))
        .register('eip155:*', new UptoEvmScheme(this.evmSigner!))

      const httpClient = new x402HTTPClient(this.x402)
      this.baseFetchWithPayment = wrapFetchWithPayment(globalThis.fetch, httpClient)
    })()

    return this.initPromise
  }

  async request<T>(url: string, options: RequestOptions = {}): Promise<PayResponse<T>> {
    await this.ensureInitialized()

    let fetchWithPayment = this.baseFetchWithPayment!

    if (options.hooks?.onBeforePayment) {
      const httpClient = new x402HTTPClient(this.x402!)
      httpClient.onPaymentRequired(async (ctx) => {
        const req = ctx.paymentRequired.accepts[0]
        if (!req) return
        const result = await options.hooks!.onBeforePayment!({ amount: req.amount, network: req.network })
        if (result?.abort) {
          throw new XPayError(result.reason ?? 'Payment aborted by onBeforePayment hook', 'PAYMENT_FAILED')
        }
      })
      fetchWithPayment = wrapFetchWithPayment(globalThis.fetch, httpClient)
    }

    let response: Response
    try {
      response = await fetchWithPayment(url, {
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

    if (options.hooks?.onAfterPayment) {
      const txId = response.headers.get('x-payment-id') ?? undefined
      await options.hooks.onAfterPayment({ transaction: txId })
    }

    const data = await response.json().catch(() => null)

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
