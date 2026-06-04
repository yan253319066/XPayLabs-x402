import { privateKeyToAccount } from 'viem/accounts'
import { Signer } from '../types'

export function fromPrivateKey(key: string): Signer {
  const account = privateKeyToAccount(key as `0x${string}`)
  return new Signer(() => Promise.resolve(account))
}
