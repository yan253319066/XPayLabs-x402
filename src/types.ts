import type { ClientEvmSigner } from '@x402/evm'

export type Chain = 'evm'

export class Signer {
  readonly chain: Chain = 'evm'
  readonly address: string
  private account: ClientEvmSigner

  constructor(account: ClientEvmSigner) {
    this.account = account
    this.address = account.address
  }

  getClientEvmSigner(): ClientEvmSigner {
    return this.account
  }
}

export interface PayOptions {
  signer: Signer
  request?: {
    method?: string
    headers?: Record<string, string>
    body?: BodyInit | null
  }
  hooks?: {
    onBeforePayment?: (ctx: { amount: string; network: string }) => Promise<{ abort?: boolean; reason?: string } | void>
    onAfterPayment?: (ctx: { transaction?: string }) => Promise<void>
  }
  fetchFn?: typeof fetch
}

export type RequestOptions = Omit<PayOptions, 'signer'>

export interface PayResponse<T = any> {
  data: T | null
  response: Response
  paymentId?: string
}
