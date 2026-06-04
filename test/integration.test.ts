/**
 * Integration test for XPayLabs-x402.
 *
 * Prerequisites:
 *   1. A Base Sepolia wallet with testnet ETH + USDC (get from https://faucet.circle.com/)
 *   2. An x402-enabled API endpoint or use the demo at https://x402.org/demo
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx test/integration.test.ts
 */

import { pay, signers, XPayError } from '../src/index'

const TEST_URL = process.env.TEST_URL ?? 'https://api.example.com/paid-endpoint'
const PRIVATE_KEY = process.env.PRIVATE_KEY

async function main() {
  if (!PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY environment variable is required')
    console.error('   Get testnet funds: https://faucet.circle.com/')
    process.exit(1)
  }

  console.log('🔑 Creating signer from private key...')
  const signer = signers.fromPrivateKey(PRIVATE_KEY)
  const account = await signer.getClientEvmSigner()
  console.log(`   Address: ${account.address}`)

  console.log(`\n📡 Sending request to ${TEST_URL}...`)
  try {
    const result = await pay(TEST_URL, { signer })
    console.log('✅ Response received:')
    console.log(`   Status: ${result.status}`)
    console.log(`   OK: ${result.ok}`)
    console.log(`   Payment settled: ${result.paymentSettled}`)
    console.log(`   Data:`, JSON.stringify(result.data, null, 2))
  } catch (err) {
    if (err instanceof XPayError) {
      console.error(`❌ XPayError [${err.code}]: ${err.message}`)
    } else {
      console.error(`❌ Error: ${err instanceof Error ? err.message : String(err)}`)
    }
    process.exit(1)
  }
}

main()
