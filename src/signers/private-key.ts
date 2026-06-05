import { privateKeyToAccount } from 'viem/accounts'
import { Signer } from '../types'

export function fromPrivateKey(key: string): Signer {
  const hexKey = (key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`
  const account = privateKeyToAccount(hexKey)
  return new Signer(account)
}
