import { fromPrivateKey } from './private-key'
import { fromMnemonic } from './mnemonic'
import { browserWallet } from './browser'

export const signers = {
  fromPrivateKey,
  fromMnemonic,
  browserWallet,
}
