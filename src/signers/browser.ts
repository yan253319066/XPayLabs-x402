import { Signer } from '../types'
import type { ClientEvmSigner } from '@x402/evm'

export function browserWallet(provider: any): Signer {
  return new Signer(async (): Promise<ClientEvmSigner> => {
    const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' })
    const address = accounts[0] as `0x${string}`
    return {
      address,
      signTypedData: async (message) => {
        return provider.request({
          method: 'eth_signTypedData_v4',
          params: [address, JSON.stringify(message)],
        })
      },
    }
  })
}
