/**
 * Integration test for XPayLabs-x402.
 *
 * Prerequisites:
 *   1. Copy .env.example to .env and fill in your PRIVATE_KEY
 *   2. A Base Sepolia wallet with testnet ETH + USDC (get from https://faucet.circle.com/)
 *   3. An x402-enabled API endpoint or use the demo at https://x402.org/demo
 *
 * Usage:
 *   npx tsx test/integration.test.ts
 */

import 'dotenv/config'
import { pay, signers, XPayError, XPayClient } from '../src/index'

const TEST_URL = process.env.TEST_URL
  const PRIVATE_KEY: string | undefined = process.env.PRIVATE_KEY

async function testPay() {
  console.log('\n═══ Test 1: pay() ═══')
  const signer = signers.fromPrivateKey(PRIVATE_KEY!)

  console.log(`📡 pay() → ${TEST_URL}`)
  try {
    const result = await pay(TEST_URL!, {
      signer,
      hooks: {
        onBeforePayment: async (ctx) => {
          console.log(`   💰 Payment required: ${ctx.amount} on ${ctx.network}`)
        },
        onAfterPayment: async (ctx) => {
          console.log(`   ✅ Payment settled: ${ctx.transaction ?? 'no tx id'}`)
        },
      },
    })
    console.log(`   Status: ${result.response.status}`)
    console.log(`   Payment ID: ${result.paymentId ?? '(none)'}`)
    if (result.data !== null) {
      console.log(`   Data:`, JSON.stringify(result.data, null, 4))
    } else {
      console.log(`   Data: (non-JSON response)`)
    }
    return true
  } catch (err) {
    if (err instanceof XPayError) {
      console.error(`   ❌ XPayError [${err.code}]: ${err.message}`)
    } else {
      console.error(`   ❌ Error: ${err instanceof Error ? err.message : String(err)}`)
    }
    return false
  }
}

async function testXPayClient() {
  console.log('\n═══ Test 2: XPayClient ═══')
  const signer = signers.fromPrivateKey(PRIVATE_KEY!)
  const client = new XPayClient({ signer })

  console.log(`📡 client.get() → ${TEST_URL}`)
  try {
    const result = await client.get(TEST_URL!, {
      hooks: {
        onBeforePayment: async (ctx) => {
          console.log(`   💰 Payment required: ${ctx.amount} on ${ctx.network}`)
        },
      },
    })
    console.log(`   Status: ${result.response.status}`)
    console.log(`   Payment ID: ${result.paymentId ?? '(none)'}`)
    if (result.data !== null) {
      console.log(`   Data:`, JSON.stringify(result.data, null, 4))
    } else {
      console.log(`   Data: (non-JSON response)`)
    }
    return true
  } catch (err) {
    if (err instanceof XPayError) {
      console.error(`   ❌ XPayError [${err.code}]: ${err.message}`)
    } else {
      console.error(`   ❌ Error: ${err instanceof Error ? err.message : String(err)}`)
    }
    return false
  }
}

async function main() {
  if (!PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY environment variable is required')
    console.error('   Get testnet funds: https://faucet.circle.com/')
    process.exit(1)
  }
  if (!TEST_URL) {
    console.error('❌ TEST_URL environment variable is required')
    console.error('   Set this to your x402-enabled API endpoint (the seller\'s server)')
    process.exit(1)
  }

  const signer = signers.fromPrivateKey(PRIVATE_KEY)
  console.log(`🔑 Signer address: ${signer.address}`)

  const ok1 = await testPay()
  const ok2 = await testXPayClient()

  console.log(`\n${ok1 && ok2 ? '✅ All tests passed' : '❌ Some tests failed'}`)
  process.exit(ok1 && ok2 ? 0 : 1)
}

main()
