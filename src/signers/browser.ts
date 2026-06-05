import { Signer } from '../types'
import type { ClientEvmSigner } from '@x402/evm'

interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
}

export async function browserWallet(provider: EIP1193Provider): Promise<Signer> {
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[]
  if (!accounts[0]) {
    throw new Error('Browser wallet returned no accounts. Ensure the wallet is unlocked and connected.')
  }
  const address = accounts[0] as `0x${string}`
  const account: ClientEvmSigner = {
    address,
    signTypedData: async (message) => {
      return provider.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(message)],
      }) as Promise<`0x${string}`>
    },
  }
  return new Signer(account)
}
