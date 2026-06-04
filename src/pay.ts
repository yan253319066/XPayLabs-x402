import { x402Client, x402HTTPClient } from '@x402/core/client'
import { wrapFetchWithPayment } from '@x402/fetch'
import { ExactEvmScheme, UptoEvmScheme } from '@x402/evm'
import type { PayOptions, PayResponse } from './types'
import { XPayError } from './error'

export async function pay<T = any>(url: string, options: PayOptions): Promise<PayResponse<T>> {
  let evmSigner
  try {
    evmSigner = await options.signer.getClientEvmSigner()
  } catch (err) {
    throw new XPayError(
      `Failed to initialize signer: ${err instanceof Error ? err.message : String(err)}`,
      'INVALID_SIGNER',
    )
  }

  const client = new x402Client()
    .register('eip155:*', new ExactEvmScheme(evmSigner))
    .register('eip155:*', new UptoEvmScheme(evmSigner))

  const httpClient = new x402HTTPClient(client)

  if (options.hooks?.onBeforePayment) {
    const hook = options.hooks.onBeforePayment
    httpClient.onPaymentRequired(async (ctx) => {
      const req = ctx.paymentRequired.accepts[0]
      if (!req) return
      const result = await hook({ amount: req.amount, network: req.network })
      if (result?.abort) {
        throw new XPayError(result.reason ?? 'Payment aborted by onBeforePayment hook', 'PAYMENT_FAILED')
      }
    })
  }

  const fetchFn = typeof globalThis !== 'undefined' ? globalThis.fetch : fetch
  const fetchWithPayment = wrapFetchWithPayment(fetchFn, httpClient)

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
      `Payment request failed: ${err instanceof Error ? err.message : String(err)}`,
      'NETWORK_ERROR',
    )
  }

  if (options.hooks?.onAfterPayment) {
    const txId = response.headers.get('x-payment-id') ?? undefined
    await options.hooks.onAfterPayment({ transaction: txId })
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
