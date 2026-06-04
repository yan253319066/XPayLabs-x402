# XPayLabs-x402

Simplify HTTP 402 payments with the x402 protocol. Pay APIs with USDC using one line of code.

```bash
npm install xpaylabs-x402
```

```typescript
import { pay, signers } from 'xpaylabs-x402'

const signer = signers.fromPrivateKey(process.env.PRIVATE_KEY)
const result = await pay('https://api.example.com/paid-endpoint', { signer })
```

## API

- `pay(url, { signer })` — One-shot payment-enabled fetch
- `signers.fromPrivateKey(key)` — EVM signer from private key
- `signers.fromMnemonic(phrase)` — EVM signer from mnemonic
- `signers.browserWallet(window.ethereum)` — EVM signer from browser wallet
- `new XPayClient({ signer })` — Reusable client with `.get()`, `.post()`, `.put()`, `.delete()`

## Docs

See [DOCUMENTATION.md](./DOCUMENTATION.md).
