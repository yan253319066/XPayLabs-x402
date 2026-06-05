> [English Docs](./README.md)

# xpaylabs-x402 — HTTP 402 微支付买家 SDK

[XPayLabs](https://github.com/yan253319066/XPayLabs-x402)（简称 **xpay**）让开发者用一行代码支付任意 x402 兼容的 HTTP API，结算使用 USDC，免去传统支付的商户对接和 KYC 成本。

```bash
npm install xpaylabs-x402
```

```typescript
import { pay, signers } from 'xpaylabs-x402'

const signer = signers.fromPrivateKey(process.env.PRIVATE_KEY)
const result = await pay('https://api.example.com/paid-endpoint', { signer })

console.log(result.data)       // 响应数据
console.log(result.paymentId)  // 链上交易 ID（有则表示已结算）
```

## 为什么用 xpaylabs-x402？

| 痛点 | xpay 方案 |
|------|-----------|
| 传统支付要 KYC、签合同、对接银行 | 链上 USDC 即时结算，零门槛 |
| x402 官方 SDK 要装 3 个包，手动注册 scheme | 一个 `npm install`，一行 `pay()` |
| 区块链签名流程复杂 | `signers.*` 工厂一行创建签名器 |
| 多链适配麻烦 | v0.1 EVM（Base / Polygon / Arbitrum / World），v0.2 扩展 Solana |

## 快速开始

### 1. 创建签名器

```typescript
import { signers } from 'xpaylabs-x402'

// 服务端：私钥签名（0x 前缀可选）
const signer = signers.fromPrivateKey(process.env.PRIVATE_KEY)

// 服务端：助记词签名
const signer = signers.fromMnemonic('test test test...', { chain: 'evm' })

// 浏览器：MetaMask 等 EIP-1193 钱包
const signer = await signers.browserWallet(window.ethereum)
console.log(signer.address)  // 0x...
console.log(signer.chain)    // 'evm'
```

### 2. 支付 API

**单次支付：**

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
      console.log(`支付 ${amount}，网络 ${network}`)
    },
    onAfterPayment: async ({ transaction }) => {
      console.log(`已结算: ${transaction}`)
    },
  },
})
```

**复用客户端：**

```typescript
const api = new XPayClient({ signer })

await api.get('https://api.example.com/users')
await api.post('https://api.example.com/analyze', {
  request: { body: JSON.stringify({ text: 'hello' }) },
})
await api.put('https://api.example.com/resource/1')
await api.delete('https://api.example.com/resource/1')
```

### 3. 自定义 Fetch

适用于 Node 18 以下或需要代理的场景：

```typescript
import { fetch } from 'undici'

await pay(url, { signer, fetchFn: fetch })
```

## 工作原理

```
pay(url, { signer })
  → GET /url
    ↓
  200? 直接返回数据，无支付
    ↓
  402 + PAYMENT-REQUIRED 头?
    → SDK 解析 price / network / scheme
    → signer 本地签名（私钥不离开进程）
    → 重试请求 + PAYMENT-SIGNATURE 头
    → 卖家验证 → Facilitator 上链结算
    → 返回 200 + x-payment-id
```

## 支持链

| 链 | 状态 | 方案 |
|-------|--------|--------|
| EVM（Base / Polygon / Arbitrum / World） | ✅ v0.1 | EIP-3009 (exact) / Permit2 (upto) |
| Solana | 🚧 v0.2 | SPL Token |
| Algorand / Stellar / Aptos / TON / Hedera | 🔮 后续 | — |

## API 参考

| 函数 | 说明 |
|----------|-------------|
| `pay(url, opts)` | 单次支付，自动处理 402 握手 |
| `signers.fromPrivateKey(key)` | 从私钥创建签名器 |
| `signers.fromMnemonic(phrase)` | 从助记词创建签名器 |
| `signers.browserWallet(provider)` | 从浏览器钱包创建签名器（异步） |
| `new XPayClient({ signer })` | 可复用的支付客户端 |
| `client.pay()` / `.get()` / `.post()` / `.put()` / `.delete()` | REST 快捷方法 |

### PayResponse

```typescript
{
  data: T | null,          // JSON 响应体
  response: Response,      // 原始 Response 对象
  paymentId?: string       // 链上交易 hash（有则表示已结算）
}
```

### 错误码

| 错误码 | 说明 |
|--------|------|
| `INVALID_SIGNER` | Signer address 为空 |
| `UNSUPPORTED_CHAIN` | 不支持的链 |
| `PAYMENT_FAILED` | Facilitator 拒绝或链上交易失败 |
| `NETWORK_ERROR` | 网络请求失败 |
| `HOOK_ABORTED` | 被 onBeforePayment 拦截 |
| `SIGNER_REQUIRED` | 未提供 signer |
| `CHAIN_NOT_SUPPORTED` | 卖家要求的链不支持 |
| `NO_VALID_SCHEME` | 卖家返回的 scheme 不支持 |

## 环境要求

- Node.js >= 18 或现代浏览器
- Base Sepolia 测试网 USDC（[CDP Faucet](https://faucet.circle.com/) 领取）
- 一个 x402 兼容的卖家 API 端点

## 链接

- [x402 协议文档](https://docs.x402.org)
- [CDP Facilitator](https://api.cdp.coinbase.com/platform/v2/x402)
- [GitHub 仓库](https://github.com/yan253319066/XPayLabs-x402)
- [English Docs](./README.md)

## 许可证

MIT
