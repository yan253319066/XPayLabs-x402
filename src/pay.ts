import type { PayOptions, PayResponse } from './types'
import { XPayClient } from './client'

export async function pay<T = any>(url: string, options: PayOptions): Promise<PayResponse<T>> {
  const client = new XPayClient({ signer: options.signer, fetchFn: options.fetchFn })
  return client.request(url, { request: options.request, hooks: options.hooks })
}
