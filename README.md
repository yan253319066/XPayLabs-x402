> [中文文档](./README.zh-CN.md)

# @xpaylabs/x402 — Buyer SDK for HTTP 402 Micropayments

## Why @xpaylabs/x402?

| Problem | xpay solution |
|---------|---------------|
| Traditional payments require KYC, contracts, bank integration | On-chain USDC, instant settlement, zero onboarding |
| Official x402 SDK needs 3 packages + manual scheme registration | One `npm install`, one `pay()` call |
| Blockchain signing is complex | `signers.*` factory creates a signer in one line |
| Multi-chain support is fragmented | v0.1 EVM (Base / Polygon / Arbitrum / World), v0.2 Solana |

## Quick Start

### 1. Create a Signer

```typescript
import { signers } from '@xpaylabs/x402'

// Server-side: private key (0x prefix optional)
const signer = signers.fromPrivateKey(process.env.PRIVATE_KEY)

// Server-side: mnemonic phrase
const signer = signers.fromMnemonic('test test test...', { chain: 'evm' })

// Browser: MetaMask or any EIP-1193 wallet
const signer = await signers.browserWallet(window.ethereum)
console.log(signer.address)  // 0x...
console.log(signer.chain)    // 'evm'
```

### 2. Pay an API

**One-shot payment:**

```typescript
const result = await pay('https://api.example.com/data', {
  signer,
  request: {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'hello' }),
  },
  hooks: {
    onBeforePayment: async ({ amount, network }) => {
      console.log(`Paying ${amount} on ${network}`)
    },
    onAfterPayment: async ({ transaction }) => {
      console.log(`Settled: ${transaction}`)
    },
  },
})
```

**Reusable client:**

```typescript
const api = new XPayClient({ signer })

await api.get('https://api.example.com/users')
await api.post('https://api.example.com/analyze', {
  request: { body: JSON.stringify({ text: 'hello' }) },
})
await api.put('https://api.example.com/resource/1')
await api.delete('https://api.example.com/resource/1')
```

### 3. Custom Fetch

For Node < 18 or proxy scenarios, pass a custom `fetchFn`:

```typescript
import { fetch } from 'undici'

await pay(url, { signer, fetchFn: fetch })
```

## How It Works

```
pay(url, { signer })
  → GET /url
    ↓
  200? Return data, no payment
    ↓
  402 + PAYMENT-REQUIRED header?
    → SDK parses price / network / scheme
    → signer signs locally (private key stays in process)
    → Retry with PAYMENT-SIGNATURE header
    → Seller verifies → Facilitator settles on-chain
    → Returns 200 + x-payment-id
```

### Payment Schemes

x402 defines three payment schemes. The SDK supports `exact` and `upto` automatically:

| Scheme | Name | Use Case |
|--------|------|----------|
| `exact` | Fixed price | Known-cost API calls, file downloads (EIP-3009, gas sponsored) |
| `upto` | Usage-based | LLM token generation, bandwidth, compute time (Permit2, pay actual usage) |
| `batch-settlement` | Batch | High-frequency micropayments (v0.1 not yet supported) |

## Supported Chains

| Chain | Status | Scheme |
|-------|--------|--------|
| EVM (Base, Polygon, Arbitrum, World) | ✅ v0.1 | EIP-3009 (exact) / Permit2 (upto) |
| Solana | 🚧 v0.2 | SPL Token |
| Algorand, Stellar, Aptos, TON, Hedera | 🔮 Future | — |

## API Reference

### pay()

```typescript
async function pay<T = any>(
  url: string,
  options: PayOptions,
): Promise<PayResponse<T>>
```

### signers

```typescript
import { signers } from '@xpaylabs/x402'

signers.fromPrivateKey(key: string): Signer
signers.fromMnemonic(phrase: string, options?: { chain?: Chain }): Signer
signers.browserWallet(provider: EIP1193Provider): Promise<Signer>
```

### XPayClient

```typescript
new XPayClient({ signer, fetchFn?: typeof fetch })

client.pay<T>(url, opts?): Promise<PayResponse<T>>
client.get<T>(url, opts?): Promise<PayResponse<T>>
client.post<T>(url, opts?): Promise<PayResponse<T>>
client.put<T>(url, opts?): Promise<PayResponse<T>>
client.delete<T>(url, opts?): Promise<PayResponse<T>>
```

### PayOptions

```typescript
interface PayOptions {
  signer: Signer
  request?: {
    method?: string
    headers?: Record<string, string>
    body?: BodyInit | null
  }
  hooks?: {
    onBeforePayment?: (ctx: { amount: string; network: string }) =>
      Promise<{ abort?: boolean; reason?: string } | void>
    onAfterPayment?: (ctx: { transaction?: string }) => Promise<void>
  }
  fetchFn?: typeof fetch
}
```

### PayResponse

```typescript
{
  data: T | null,          // JSON response body (null if not JSON)
  response: Response,      // raw Response object
  paymentId?: string       // on-chain tx hash (present = settled)
}
```

### Error Codes

| Code | Meaning |
|------|---------|
| `INVALID_SIGNER` | Signer has no address |
| `UNSUPPORTED_CHAIN` | Chain not supported by the factory |
| `PAYMENT_FAILED` | Facilitator rejected or on-chain failure |
| `NETWORK_ERROR` | Network request failed |
| `HOOK_ABORTED` | Aborted by onBeforePayment hook |
| `SIGNER_REQUIRED` | No signer provided |
| `CHAIN_NOT_SUPPORTED` | Seller's chain not supported |
| `NO_VALID_SCHEME` | Seller's payment scheme not supported |

## FAQ

### Do I need to understand the x402 protocol?

No. The SDK handles the 402 handshake, signing, and retry automatically.

### Do I need blockchain experience?

No. `signers.fromPrivateKey()` or `signers.fromMnemonic()` creates a signer in one line.

### Where does the money go?

Buyer signs a USDC transfer → Facilitator verifies and settles on-chain → USDC goes to the seller's wallet. The facilitator is configured by the seller, not the buyer.

### Where is my private key stored?

Never leaves your process.

| Signer | Signing location |
|--------|-----------------|
| `fromPrivateKey(key)` | In-process via viem |
| `fromMnemonic(phrase)` | In-process via viem |
| `browserWallet(provider)` | Inside the browser wallet (MetaMask prompts user) |

### How do I get testnet USDC?

Use the [CDP Faucet](https://faucet.circle.com/) to get Base Sepolia ETH + USDC.

### What if the API doesn't require payment?

If the server returns 200, the SDK returns the data directly — no payment flow triggered.

## Requirements

- Node.js >= 18 or modern browser
- Base Sepolia testnet USDC ([CDP Faucet](https://faucet.circle.com/))
- An x402-compatible seller API endpoint

## Installation

```bash
npm install xpaylabs-x402
# or
yarn add @xpaylabs/x402

pnpm add @xpaylabs/x402
```

## Links

- [x402 Protocol Docs](https://docs.x402.org)
- [CDP Facilitator](https://api.cdp.coinbase.com/platform/v2/x402)
- [GitHub](https://github.com/yan253319066/XPayLabs-x402)
- [中文文档](./README.zh-CN.md)

## License

MIT
