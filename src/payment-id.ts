import { x402HTTPClient } from '@x402/core/client'

export function extractPaymentId(
  httpClient: x402HTTPClient,
  response: Response,
): string | undefined {
  const settleResponse = httpClient.getPaymentSettleResponse(
    (name: string) => response.headers.get(name),
  )
  return settleResponse?.transaction ?? undefined
}
