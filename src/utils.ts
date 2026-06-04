import { Signer } from './types'

export function isEvmSigner(signer: Signer): boolean {
  return signer.chain === 'evm'
}
