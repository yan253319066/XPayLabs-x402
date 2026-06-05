import { x402HTTPClient } from '@x402/core/client'

export function extractPaymentId(
  httpClient: x402HTTPClient,
  response: Response,
): string | undefined {
  try {
    const settleResponse = httpClient.getPaymentSettleResponse(
      (name: string) => response.headers.get(name),
    )
    return settleResponse?.transaction ?? undefined
  } catch (err) {
    if (err instanceof Error && err.message === 'Payment response header not found') {
      console.debug('[XPay] No x402 payment header found — regular API call, paymentId will be undefined')
      return undefined
    }
    throw err
  }
}
