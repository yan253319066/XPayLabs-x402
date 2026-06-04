import { mnemonicToAccount } from 'viem/accounts'
import { Signer } from '../types'

export function fromMnemonic(phrase: string): Signer {
  const account = mnemonicToAccount(phrase)
  return new Signer(() => Promise.resolve(account))
}
