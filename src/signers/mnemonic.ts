import { mnemonicToAccount } from 'viem/accounts'
import type { Chain } from '../types'
import { Signer } from '../types'

export function fromMnemonic(phrase: string, options?: { chain?: Chain }): Signer {
  const account = mnemonicToAccount(phrase)
  return new Signer(() => Promise.resolve(account))
}
