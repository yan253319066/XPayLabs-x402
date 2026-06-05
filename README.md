> [中文文档](./README.zh-CN.md)

# xpaylabs-x402 — Buyer SDK for HTTP 402 Micropayments

[XPayLabs](https://github.com/yan253319066/XPayLabs-x402) (short: **xpay**) provides a one-line buyer SDK for the [x402 protocol](https://docs.x402.org). Pay any HTTP API with USDC — no KYC, no merchant account, no bank integration.

```bash
npm install xpaylabs-x402
```

```typescript
import { pay, signers } from 'xpaylabs-x402'

const signer = signers.fromPrivateKey(process.env.PRIVATE_KEY)
const result = await pay('https://api.example.com/paid-endpoint', { signer })

console.log(result.data)       // JSON response body
console.log(result.paymentId)  // on-chain tx hash (present = settled)
```

## Why xpaylabs-x402?

| Problem | xpay solution |
|---------|---------------|
| Traditional payments require KYC, contracts, bank integration | On-chain USDC, instant settlement, zero onboarding |
| Official x402 SDK needs 3 packages + manual scheme registration | One `npm install`, one `pay()` call |
| Blockchain signing is complex | `signers.*` factory creates a signer in one line |
| Multi-chain support is fragmented | v0.1 EVM (Base / Polygon / Arbitrum / World), v0.2 Solana |

## Quick Start

### 1. Create a Signer

```typescript
import { signers } from 'xpaylabs-x402'

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

## Supported Chains

| Chain | Status | Scheme |
|-------|--------|--------|
| EVM (Base, Polygon, Arbitrum, World) | ✅ v0.1 | EIP-3009 (exact) / Permit2 (upto) |
| Solana | 🚧 v0.2 | SPL Token |
| Algorand, Stellar, Aptos, TON, Hedera | 🔮 Future | — |

## API Reference

| Function | Description |
|----------|-------------|
| `pay(url, opts)` | One-shot payment-enabled HTTP request |
| `signers.fromPrivateKey(key)` | Create signer from private key |
| `signers.fromMnemonic(phrase)` | Create signer from mnemonic |
| `signers.browserWallet(provider)` | Create signer from browser wallet (async) |
| `new XPayClient({ signer })` | Reusable payment client |
| `client.pay()` / `.get()` / `.post()` / `.put()` / `.delete()` | REST convenience methods |

### PayResponse

```typescript
{
  data: T | null,          // JSON response body
  response: Response,      // raw Response object
  paymentId?: string       // on-chain tx hash (present = settled)
}
```

### Error Codes

| Code | Meaning |
|------|---------|
| `INVALID_SIGNER` | Signer has no address |
| `UNSUPPORTED_CHAIN` | Chain not supported |
| `PAYMENT_FAILED` | Facilitator rejected or on-chain failure |
| `NETWORK_ERROR` | Network request failed |
| `HOOK_ABORTED` | Aborted by onBeforePayment hook |
| `SIGNER_REQUIRED` | No signer provided |
| `CHAIN_NOT_SUPPORTED` | Seller's chain not supported |
| `NO_VALID_SCHEME` | Seller's payment scheme not supported |

## Requirements

- Node.js >= 18 or modern browser
- Base Sepolia testnet USDC ([CDP Faucet](https://faucet.circle.com/))
- An x402-compatible seller API endpoint

## Links

- [x402 Protocol Docs](https://docs.x402.org)
- [CDP Facilitator](https://api.cdp.coinbase.com/platform/v2/x402)
- [GitHub](https://github.com/yan253319066/XPayLabs-x402)
- [中文文档](./README.zh-CN.md)

## License

MIT
