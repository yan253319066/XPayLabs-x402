import { mnemonicToAccount } from 'viem/accounts'
import type { Chain } from '../types'
import { Signer } from '../types'
import { XPayError } from '../error'

export function fromMnemonic(phrase: string, options?: { chain?: Chain }): Signer {
  const chain = options?.chain ?? 'evm'
  if (chain !== 'evm') {
    throw new XPayError(`Unsupported chain: ${chain}`, 'UNSUPPORTED_CHAIN')
  }
  const account = mnemonicToAccount(phrase)
  return new Signer(() => Promise.resolve(account))
}
