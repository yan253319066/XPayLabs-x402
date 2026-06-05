> [English Docs](./README.md)

# @xpaylabs/x402 — HTTP 402 微支付买家 SDK

```javascript
import { pay, signers } from '@xpaylabs/x402'

const signer = signers.fromPrivateKey(process.env.PRIVATE_KEY)
const result = await pay('https://api.example.com/paid-endpoint', { signer })

console.log(result.data)       // 响应数据
console.log(result.paymentId)  // 链上交易 ID（有则表示已结算）
```

## 适用人群

| 角色 | 使用方式 |
|------|----------|
| **AI Agent 开发者** | Agent 动态调用付费 LLM、数据源、工具 — 无需预配 API Key |
| **Node.js 后端开发者** | 无需商户资质或 KYC，直接调用第三方付费 API |
| **浏览器 dApp 开发者** | 用户通过 MetaMask 为高级功能或计算资源付费 |
| **自动化脚本开发者** | 爬虫、监控、CI/CD 按次付费调用 |
| **SaaS 平台** | 将 x402 作为 API 市场计费层集成 |
| **IoT / 机器对机器** | 传感器、边缘设备自动为数据中继或算力付费 |
| **游戏开发者** | 游戏内微支付、道具购买、跳过等待，用户无需 Gas |
| **内容创作者** | 付费文章、视频、播客 — 按次查看，无订阅捆绑 |
| **研究者 / 学者** | 按数据集或 API 调用付费，无需走采购流程 |
| **自由职业者 / 平台工人** | 微任务结算、按小时赚取 USDC，即时到账 |

## 使用场景

- **AI / LLM**：Agent 调用付费 LLM 端点，按 token 用量用 USDC 结算，无需管理 API Key
- **数据 API**：金融数据、天气、地理位置、市场研究的按查询付费
- **计算资源**：图片生成、视频处理、ML 模型推理的按次收费
- **内容付费**：付费文章、报告、媒体文件的按次查看
- **基础设施**：DNS、CDN、监控等 API 的按请求付费
- **IoT / DePIN**：传感器数据上传、存储证明、网络带宽的机器对机器微支付
- **游戏内经济**：购买道具、体力、跳过广告 — 即时链上结算，无需 Gas
- **Agent 间结算**：AI Agent A 调用 Agent B 的服务，自动 USDC 转账
- **预测市场**：每条预测投注几美分，链上即时开奖结算
- **实时数据流**：按秒付费订阅实时价格、交易对、新闻流
- **API 编排**：一次用户请求背后，自动调用多个付费微 API 并逐一结算
- **训练数据市场**：每条标注样本付费，买多少付多少
- **去订阅制内容**：零散阅读，无月费捆绑，按篇付费

## 为什么用 @xpaylabs/x402？

| 痛点 | xpay 方案 |
|------|-----------|
| 传统支付要 KYC、签合同、对接银行 | 链上 USDC 即时结算，零门槛 |
| x402 官方 SDK 要装 3 个包，手动注册 scheme | 一个 `npm install`，一行 `pay()` |
| 区块链签名流程复杂 | `signers.*` 工厂一行创建签名器 |
| 多链适配麻烦 | v0.1 EVM（Base / Polygon / Arbitrum / World），v0.2 扩展 Solana |

## 快速开始

### 1. 创建签名器

```typescript
import { signers } from '@xpaylabs/x402'

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

### 支付方案

x402 定义了三种支付方案，SDK 自动支持 `exact` 和 `upto`：

| 方案 | 名称 | 适用场景 |
|------|------|----------|
| `exact` | 固定价格 | 已知成本的 API 调用、文件下载（EIP-3009，Gas 赞助） |
| `upto` | 按用量计费 | LLM token、带宽、计算时间（Permit2，按实际扣费） |
| `batch-settlement` | 批量结算 | 高频微支付（v0.1 暂不支持） |

## 支持链

| 链 | 状态 | 方案 |
|-------|--------|--------|
| EVM（Base / Polygon / Arbitrum / World） | ✅ v0.1 | EIP-3009 (exact) / Permit2 (upto) |
| Solana | 🚧 v0.2 | SPL Token |
| Algorand / Stellar / Aptos / TON / Hedera | 🔮 后续 | — |

## API 参考

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
  data: T | null,          // JSON 响应体（非 JSON 返回 null）
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

## 常见问题

### 需要理解 x402 协议吗？

不需要。SDK 自动处理 402 握手、签名、重试，开发者只需 `pay(url, { signer })`。

### 需要区块链开发经验吗？

不需要。`signers.fromPrivateKey(key)` 一行创建签名器，剩余流程 SDK 自动完成。

### 钱给了谁？

买家签名授权 USDC → Facilitator 验证上链 → USDC 到卖家钱包。Facilitator 由卖家配置，买家无需关心。

### 私钥安全吗？

| 签名器 | 签名位置 |
|--------|----------|
| `fromPrivateKey(key)` | 当前进程内（viem 本地签名） |
| `fromMnemonic(phrase)` | 当前进程内（viem 本地签名） |
| `browserWallet(provider)` | 浏览器插件钱包内（MetaMask 弹窗确认） |

私钥**永远不离开**当前进程或钱包。

### 如何获取测试网 USDC？

[CDP Faucet](https://faucet.circle.com/) 领取 Base Sepolia 测试网 ETH + USDC。

### 如果 API 不需要支付怎么办？

服务端返回 200 时，SDK 直接返回数据，不触发支付流程。

## 环境要求

- Node.js >= 18 或现代浏览器
- Base Sepolia 测试网 USDC（[CDP Faucet](https://faucet.circle.com/) 领取）
- 一个 x402 兼容的卖家 API 端点

## 安装

```bash
npm install @xpaylabs/x402
# 或
yarn add @xpaylabs/x402

pnpm add @xpaylabs/x402
```

## 链接

- [x402 协议文档](https://docs.x402.org)
- [CDP Facilitator](https://api.cdp.coinbase.com/platform/v2/x402)
- [GitHub 仓库](https://github.com/yan253319066/XPayLabs-x402)
- [English Docs](./README.md)

## 许可证

MIT
