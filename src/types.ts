import type { ClientEvmSigner } from '@x402/evm'

export type Chain = 'evm'

export class Signer {
  readonly chain: Chain = 'evm'

  constructor(private _getAccount: () => Promise<ClientEvmSigner>) {}

  /** @internal */
  getClientEvmSigner(): Promise<ClientEvmSigner> {
    return this._getAccount()
  }
}

export interface PayOptions {
  signer: Signer
  method?: string
  headers?: Record<string, string>
  body?: BodyInit | null
  facilitatorUrl?: string
  hooks?: {
    onBeforePayment?: (ctx: { amount: string; network: string }) => Promise<{ abort?: boolean; reason?: string } | void>
    onAfterPayment?: (ctx: { transaction?: string }) => Promise<void>
  }
}

export type RequestOptions = Omit<PayOptions, 'signer'>

export interface PayResponse<T = any> {
  data: T
  status: number
  ok: boolean
  statusText: string
  headers: Headers
  paymentSettled: boolean
}
