import { x402Client, x402HTTPClient } from '@x402/core/client'
import { wrapFetchWithPayment } from '@x402/fetch'
import { ExactEvmScheme, UptoEvmScheme } from '@x402/evm'
import type { PayResponse, RequestOptions } from './types'
import { Signer } from './types'
import { XPayError } from './error'
import { extractPaymentId } from './payment-id'

export class XPayClient {
  private evmSigner: ReturnType<Signer['getClientEvmSigner']> | null = null
  private x402: x402Client | null = null
  private httpClient: x402HTTPClient | null = null
  private baseFetchWithPayment: ReturnType<typeof wrapFetchWithPayment> | null = null
  private initPromise: Promise<void> | null = null
  private signer: Signer
  private fetchFn: typeof fetch

  constructor(config: { signer: Signer; fetchFn?: typeof fetch }) {
    this.signer = config.signer
    this.fetchFn = config.fetchFn ?? globalThis.fetch
  }

  private async ensureInitialized(): Promise<void> {
    if (this.x402) return
    if (this.initPromise) return this.initPromise

    if (!this.signer.address) {
      throw new XPayError('Signer address is required', 'INVALID_SIGNER')
    }

    this.initPromise = (async () => {
      try {
        this.evmSigner = this.signer.getClientEvmSigner()
      } catch (err) {
        throw new XPayError(
          `Failed to initialize signer: ${err instanceof Error ? err.message : String(err)}`,
          'INVALID_SIGNER',
        )
      }

      this.x402 = new x402Client()
        .register('eip155:*', new ExactEvmScheme(this.evmSigner!))
        .register('eip155:*', new UptoEvmScheme(this.evmSigner!))

      this.httpClient = new x402HTTPClient(this.x402)
      this.baseFetchWithPayment = wrapFetchWithPayment(this.fetchFn, this.httpClient)
    })()

    return this.initPromise
  }

  async request<T>(url: string, options: RequestOptions = {}): Promise<PayResponse<T>> {
    await this.ensureInitialized()

    let fetchWithPayment = this.baseFetchWithPayment!
    let settleHttpClient = this.httpClient!

    if (options.hooks?.onBeforePayment) {
      settleHttpClient = new x402HTTPClient(this.x402!)
      settleHttpClient.onPaymentRequired(async (ctx) => {
        const req = ctx.paymentRequired.accepts[0]
        if (!req) return
        const result = await options.hooks!.onBeforePayment!({ amount: req.amount, network: req.network })
        if (result?.abort) {
          throw new XPayError(result.reason ?? 'Payment aborted by onBeforePayment hook', 'HOOK_ABORTED')
        }
      })
      fetchWithPayment = wrapFetchWithPayment(this.fetchFn, settleHttpClient)
    }

    let response: Response
    try {
      response = await fetchWithPayment(url, {
        method: options.request?.method ?? 'GET',
        headers: options.request?.headers as Record<string, string>,
        body: options.request?.body as BodyInit | undefined,
      })
    } catch (err) {
      if (err instanceof XPayError) throw err
      throw new XPayError(
        `Request failed: ${err instanceof Error ? err.message : String(err)}`,
        'NETWORK_ERROR',
      )
    }

    const paymentId = extractPaymentId(settleHttpClient, response)

    if (options.hooks?.onAfterPayment) {
      await options.hooks.onAfterPayment({ transaction: paymentId })
    }

    const data = await response.json().catch(() => null)

    return {
      data,
      response,
      paymentId,
    }
  }

  async pay<T>(url: string, options?: RequestOptions): Promise<PayResponse<T>> {
    return this.request<T>(url, options)
  }

  async get<T>(url: string, options?: RequestOptions): Promise<PayResponse<T>> {
    return this.request<T>(url, { ...options, request: { ...options?.request, method: 'GET' } })
  }

  async post<T>(url: string, options?: RequestOptions): Promise<PayResponse<T>> {
    return this.request<T>(url, { ...options, request: { ...options?.request, method: 'POST' } })
  }

  async put<T>(url: string, options?: RequestOptions): Promise<PayResponse<T>> {
    return this.request<T>(url, { ...options, request: { ...options?.request, method: 'PUT' } })
  }

  async delete<T>(url: string, options?: RequestOptions): Promise<PayResponse<T>> {
    return this.request<T>(url, { ...options, request: { ...options?.request, method: 'DELETE' } })
  }
}
