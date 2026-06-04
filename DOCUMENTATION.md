# XPayLabs-x402 SDK — 规划与设计文档

> 让不懂 x402 和区块链的开发者也能在 5 分钟内接入 HTTP 402 支付。

---

## 目录

1. [项目背景](#1-项目背景)
2. [架构概览](#2-架构概览)
3. [API 规格](#3-api-规格)
4. [包结构与构建](#4-包结构与构建)
5. [进阶用法](#5-进阶用法)
6. [FAQ](#6-faq)
7. [参考链接](#7-参考链接)

---

## 1. 项目背景

### 什么是 x402？

[x402](https://docs.x402.org) 是一个开放支付协议，利用 HTTP 402 Payment Required 状态码实现 API 级别的微支付。当客户端请求一个受保护的资源时，服务端返回 402 + `PAYMENT-REQUIRED` 头；客户端签名一笔链上交易并重试请求，即可获得资源。

详见[买家快速开始](https://docs.x402.org/getting-started/quickstart-for-buyers)和[网络与 Token 支持](https://docs.x402.org/core-concepts/network-and-token-support)。

### 为什么需要 XPayLabs-x402？

原生 x402 的使用流程涉及：

1. 安装 `@x402/fetch` + `@x402/evm` + `viem` 等多个包
2. 理解 `x402Client`、`ExactEvmScheme`、`wrapFetchWithPayment` 等概念
3. 手动注册支付方案（scheme）
4. 构造 signer 并注册 network 标识符

这对不熟悉区块链和 x402 协议的开发者来说非常复杂。XPayLabs-x402 的目标是 **将一个 5 步流程压缩为 1 步**。

### 对比

| 步骤 | 原生 x402 | XPayLabs-x402 |
|------|-----------|---------------|
| 安装 | `npm install @x402/fetch @x402/evm viem` | `npm install xpaylabs-x402` |
| 导入 | 4~5 个 import | `import { pay } from 'xpaylabs-x402'` |
| 初始化 | 创建 signer → 创建 x402Client → register scheme → wrap fetch | 只需传入 signer |
| 调用 | `await fetchWithPayment(url, options)` | `await pay(url, { signer })` |
| 签名器 | viem + scheme 分别构造 | `signers.*` 一行搞定 |

### 设计目标

1. **零区块链知识要求** — 用 `signers.fromPrivateKey()` 或 `signers.fromMnemonic()` 一行拿到 signer，其余的 SDK 自动完成
2. **单包依赖** — 安装一个 npm 包即可使用
3. **浏览器优先** — `signers.browserWallet(window.ethereum)` 支持 MetaMask 等插件钱包，私钥不离开钱包
4. **自动多 scheme** — 默认注册 exact + upto，自动匹配服务端支付方案
5. **多链渐进** — v0.1 聚焦 EVM，v0.2 加入 Solana，后续覆盖 x402 全部 7 条链
6. **TypeScript 优先** — 完整的类型定义，IDE 自动补全
7. **双重导出** — 支持 `import` (ESM) 和 `require` (CJS)
8. **可扩展** — 高级用户可通过 hooks 拦截支付流程

---

## 2. 架构概览

### 依赖关系

```
xpaylabs-x402
├── @x402/fetch       ← x402 官方 fetch 封装（自动处理 402 响应）
├── @x402/evm         ← EVM 支付方案（ExactEvmScheme + UptoEvmScheme）
├── @x402/core        ← (被 @x402/fetch 间接依赖) x402 核心 client
└── viem              ← EVM 钱包操作（privateKeyToAccount 创建 signer）
```

### 核心模块

```
src/
├── index.ts          # 入口文件，导出所有公共 API
├── types.ts          # 类型定义（Signer 接口、PayOptions、PayResponse 等）
├── client.ts         # XPayClient 类（可复用实例）
├── pay.ts            # pay() 顶级函数（接收 signer）
├── signers/          # 签名器工厂
│   ├── index.ts
│   ├── private-key.ts   # signers.fromPrivateKey()
│   ├── mnemonic.ts      # signers.fromMnemonic()
│   └── browser.ts       # signers.browserWallet()
└── utils.ts          # 工具函数（链检测、类型守卫等）
```

### 工作流

```
① 开发者通过 signers.* 创建 signer
    │       signers.fromPrivateKey(key)    ← 服务端
    │       signers.fromMnemonic(phrase)   ← 服务端 / AI Agent
    │       signers.browserWallet(provider) ← 浏览器插件钱包
    ▼
② 调用 pay(url, { signer })
    │
③ SDK 自动注册精确（exact）+ 用量（upto）两种 scheme
    │   ExactEvmScheme → EIP-3009（USDC 原生转账，gas 由 facilitator 赞助）
    │   UptoEvmScheme  → Permit2（最大金额授权，按实际用量扣费）
    ▼
④ 调用 wrapFetchWithPaymentFromConfig 包装 fetch
    │
⑤ 发起 HTTP 请求
    │
⑥ 收到 402 → SDK 自动匹配 scheme 和 network → signer 签名 → 重试
    │
⑦ 返回响应数据（JSON / text / buffer）
    │
⑧ （可选）高级用户可通过 hooks 拦截支付前/后事件
```

---

## 3. API 规格

每个公共 API 给出函数签名、类型定义和内联示例，AI 按此实现。

### 3.1 `pay()` — 核心支付函数

```typescript
// 签名
function pay<T = any>(
  url: string,
  options: PayOptions
): Promise<PayResponse<T>>
```

```typescript
// 内部实现（使用 @x402/fetch）
import { wrapFetchWithPaymentFromConfig } from '@x402/fetch'
import { x402ClientFromConfig } from '@x402/core'
import { ExactEvmScheme, UptoEvmScheme } from '@x402/evm'

async function pay<T>(url: string, options: PayOptions): Promise<PayResponse<T>> {
  const client = x402ClientFromConfig({
    facilitatorUrl: options.facilitatorUrl ?? 'https://x402.org/facilitator'
  })
  client.register('eip155:*', new ExactEvmScheme())
  client.register('eip155:*', new UptoEvmScheme())

  const fetchWithPayment = wrapFetchWithPaymentFromConfig(client, options.signer)

  if (options.hooks?.onBeforePayment) {
    // 注册 onBeforePayment 到 x402 lifecycle hooks
  }
  if (options.hooks?.onAfterPayment) {
    // 注册 onAfterPayment 到 x402 lifecycle hooks
  }

  const response = await fetchWithPayment(url, {
    method: options.method ?? 'GET',
    headers: options.headers,
    body: options.body,
  })

  const data = await response.json()
  return {
    data,
    status: response.status,
    ok: response.ok,
    statusText: response.statusText,
    headers: response.headers,
    paymentSettled: response.headers.has('x-payment-id'),
  }
}
```

```typescript
// 服务端：从私钥创建 signer
import { pay, signers } from 'xpaylabs-x402'

const signer = signers.fromPrivateKey(process.env.PRIVATE_KEY)
const result = await pay('https://api.example.com/paid-endpoint', { signer })
```

```typescript
// 浏览器：从 MetaMask 创建 signer
import { pay, signers } from 'xpaylabs-x402'

const signer = signers.browserWallet(window.ethereum)
const result = await pay('https://api.example.com/paid-endpoint', { signer })
```

```typescript
// 服务端：从助记词创建 signer
import { pay, signers } from 'xpaylabs-x402'

const signer = signers.fromMnemonic(process.env.MNEMONIC)
const result = await pay(url, { signer })
```

```typescript
// 自定义请求参数（POST + JSON body）
const result = await pay(url, {
  signer,
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'hello' })
})
```

```typescript
// 自定义 Facilitator
const result = await pay(url, {
  signer,
  facilitatorUrl: 'https://api.cdp.coinbase.com/platform/v2/x402'
})
```

```typescript
// 错误处理与重试
import { XPayError } from 'xpaylabs-x402'

async function fetchWithRetry(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await pay(url, { signer })
    } catch (err) {
      if (err instanceof XPayError && err.code === 'PAYMENT_FAILED') {
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries exceeded')
}
```

### 3.2 `signers.*` — 签名器工厂

```typescript
// 签名
interface Signers {
  fromPrivateKey(key: string): Signer
  fromMnemonic(phrase: string, options?: { chain?: Chain }): Signer
  browserWallet(provider: any): Signer
}

type Chain = 'evm'  // v0.1 仅 EVM，v0.2 扩展 'solana'
```

```typescript
// 用法
import { signers } from 'xpaylabs-x402'

// EVM: 0x 开头的私钥
const s1 = signers.fromPrivateKey(process.env.PRIVATE_KEY)

// 12 / 24 词助记词
const s2 = signers.fromMnemonic(process.env.MNEMONIC)

// 浏览器插件钱包
const s3 = signers.browserWallet(window.ethereum)
```

> v0.1 链类型不自动检测，统一为 EVM。用户可通过 `options.chain` 预留扩展。

### 3.3 `XPayClient` — 可复用实例

```typescript
// 签名
class XPayClient {
  constructor(config: { signer: Signer; facilitatorUrl?: string })

  get<T>(url: string, options?: RequestOptions): Promise<PayResponse<T>>
  post<T>(url: string, options?: RequestOptions): Promise<PayResponse<T>>
  put<T>(url: string, options?: RequestOptions): Promise<PayResponse<T>>
  delete<T>(url: string, options?: RequestOptions): Promise<PayResponse<T>>

  request<T>(url: string, options?: RequestOptions): Promise<PayResponse<T>>
}
```

```typescript
// 基础用法
import { XPayClient, signers } from 'xpaylabs-x402'

const signer = signers.fromPrivateKey(process.env.PRIVATE_KEY)
const api = new XPayClient({ signer })

const users = await api.get('https://api.example.com/users')
const posts = await api.get('https://api.example.com/posts')
const result = await api.post('https://api.example.com/analyze', {
  body: { text: 'hello world' }
})
```

```typescript
// 与 Express 后端配合
import { XPayClient, signers } from 'xpaylabs-x402'
import express from 'express'

const signer = signers.fromPrivateKey(process.env.PRIVATE_KEY)
const client = new XPayClient({ signer })
const app = express()

app.get('/proxy/ai-completion', async (req, res) => {
  const result = await client.post('https://api.ai-service.com/generate', {
    body: { prompt: req.query.q },
    headers: { 'Content-Type': 'application/json' }
  })
  res.json(result.data)
})
```

### 3.4 类型定义

```typescript
/** @internal 签名器接口 — 所有 signers.* 工厂都返回此类型 */
interface Signer {
  readonly chain: 'evm'
}

interface PayOptions {
  /** 签名器（必填），通过 signers.* 工厂创建 */
  signer: Signer
  /** 请求方法，默认 GET */
  method?: string
  /** 自定义请求头 */
  headers?: Record<string, string>
  /** 请求体 */
  body?: BodyInit | null
  /** Facilitator URL，默认使用 x402.org 公共 facilitator */
  facilitatorUrl?: string
  /** 支付生命周期钩子（高级功能） */
  hooks?: {
    onBeforePayment?: (ctx: { amount: string; network: string }) => Promise<{ abort?: boolean; reason?: string } | void>
    onAfterPayment?: (ctx: { transaction?: string }) => Promise<void>
  }
}

/** XPayClient 方法使用的选项（不含 signer，由 client 实例持有） */
type RequestOptions = Omit<PayOptions, 'signer'>

interface PayResponse<T = any> {
  /** 解析后的响应数据 */
  data: T
  /** HTTP 状态码 */
  status: number
  /** 是否成功（2xx） */
  ok: boolean
  /** 状态文本 */
  statusText: string
  /** 原始 Headers */
  headers: Headers
  /** 是否成功完成支付 */
  paymentSettled: boolean
}
```

### 3.5 错误类型

```typescript
class XPayError extends Error {
  code: 'UNSUPPORTED_CHAIN' | 'INVALID_SIGNER' | 'PAYMENT_FAILED' | 'NETWORK_ERROR'
}
```

```typescript
// 使用
try {
  const result = await pay(url, { signer })
} catch (error) {
  if (error instanceof XPayError) {
    switch (error.code) {
      case 'UNSUPPORTED_CHAIN':
        console.error('不支持的链类型')
        break
      case 'INVALID_SIGNER':
        console.error('signer 无效或不兼容')
        break
      case 'PAYMENT_FAILED':
        console.error('支付失败')
        break
      case 'NETWORK_ERROR':
        console.error('网络请求失败')
        break
    }
  }
}
```

---

## 4. 包结构与构建

### 4.1 目录结构

```
xpaylabs-x402/
├── src/
│   ├── index.ts          # 入口
│   ├── types.ts          # 类型定义
│   ├── client.ts         # XPayClient
│   ├── pay.ts            # pay()
│   ├── error.ts          # XPayError
│   ├── signers/
│   │   ├── index.ts
│   │   ├── private-key.ts
│   │   ├── mnemonic.ts
│   │   └── browser.ts
│   └── utils.ts
├── dist/                    # 构建产物（gitignore）
│   ├── index.js             # ESM 入口
│   ├── index.cjs            # CJS 入口
│   ├── index.d.ts
│   └── signers/
│       ├── index.js
│       ├── index.cjs
│       └── index.d.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── DOCUMENTATION.md
├── README.md
├── LICENSE
└── .npmignore
```

### 4.2 package.json

```jsonc
{
  "name": "xpaylabs-x402",
  "version": "0.1.0",
  "description": "Simplify HTTP 402 payments with x402 protocol. Pay APIs with USDC using one line of code.",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./signers": {
      "types": "./dist/signers/index.d.ts",
      "import": "./dist/signers/index.js",
      "require": "./dist/signers/index.cjs"
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "keywords": ["x402", "http-402", "payment", "usdc", "web3", "ethereum", "micropayments"],
  "license": "MIT",
  "dependencies": {
    "@x402/core": "^2.14.0",
    "@x402/evm": "^2.14.0",
    "@x402/fetch": "^2.14.0",
    "viem": "^2.21.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "tsup": "^8.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "scripts": {
    "build": "tsup",
    "build:watch": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "lint": "biome check src/",
    "lint:fix": "biome check --apply src/",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "npm run build",
    "release": "npm run build && npm publish"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

### 4.3 tsup

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "signers/index": "src/signers/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
})
```

### 4.4 tsconfig

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### 4.5 .npmignore

```
src/
node_modules/
.vscode/
tsconfig.json
tsup.config.ts
vitest.config.ts
```

### 4.6 开发命令

```bash
# 安装依赖
npm install

# 开发模式（监听文件变更）
npx tsup --watch

# 类型检查
npm run typecheck

# Lint
npm run lint

# 构建
npm run build

# 单元测试
npm run test

# 集成测试（需要环境变量）
PRIVATE_KEY=0x... npx tsx test/integration.test.ts
```

---

## 5. 进阶用法

### 5.1 支付方案（Payment Schemes）

x402 定义了三种支付方案，SDK 默认注册 `exact` + `upto`：

| 方案 | 名称 | 适用场景 | EVM 实现 |
|------|------|----------|---------|
| `exact` | 固定价格 | 已知成本的 API 调用、文件下载 | EIP-3009（USDC 原生），gas 由 facilitator 赞助 |
| `upto` | 按用量计费 | LLM token 生成、带宽、计算时间 | Permit2（授权最大金额，按实际用量扣费） |
| `batch-settlement` | 批量结算 | 高频微支付，先预存再批量上链 | 押金通道 + 离线凭证，v0.1 暂不支持 |

开发者无需感知这些差异，SDK 自动匹配服务端返回的 scheme。

### 5.2 生命周期钩子（Lifecycle Hooks）

通过 `pay()` 的 `hooks` 选项拦截支付流程，适合风控、日志、限额控制：

```typescript
const result = await pay(url, {
  signer,
  hooks: {
    onBeforePayment: async ({ amount, network }) => {
      if (BigInt(amount) > BigInt("1000000")) {
        return { abort: true, reason: "超过单次支付限额" }
      }
    },
    onAfterPayment: async ({ transaction }) => {
      console.log("支付完成，交易 hash:", transaction)
    },
  },
})
```

### 5.3 自定义 Facilitator

默认使用 x402.org 公共 facilitator（测试网免费）。生产环境可指定 CDP 等：

```typescript
const result = await pay(url, {
  signer,
  facilitatorUrl: 'https://api.cdp.coinbase.com/platform/v2/x402'
})
```

支持的 Facilitator: CDP、PayAI、Corbits、Dexter、Mogami 等 8+ 个。

### 5.4 多链扩展

v0.1 仅 EVM。后续通过实现 `SignerAdapter` 接口扩展：

```typescript
// 内部扩展方式（示例）
registerChain('aptos', {
  createScheme(signer): SchemeClient,
  networkId: 'aptos:*'
})
```

对外只需要一个新的 `signers.*` 工厂函数。

---

## 6. FAQ

### 6.1 我需要理解 x402 协议吗？

不需要。`xpaylabs-x402` 完全封装了 x402 协议细节，你只需创建 signer 然后调用 `pay()`。

### 6.2 我需要有区块链开发经验吗？

不需要。用 `signers.fromPrivateKey(key)` 或 `signers.fromMnemonic(phrase)` 一行拿到 signer，剩下的 SDK 自动处理。

### 6.3 卖家怎么收款？钱去了哪里？

x402 的收款完全由 **Facilitator** 处理，卖家不需要自己部署链上节点。

**资金流：**

```
买家签名授权 USDC → Facilitator 验证 → Facilitator 上链结算 → USDC 到卖家钱包
```

**卖家只需要三步：**

1. 在 API 里安装 x402 中间件（如 `@x402/express`）
2. 配置受保护的路由，写上 **自己的钱包地址** 和定价
3. 选择一个 Facilitator（测试用 x402.org，生产用 CDP 等）

```typescript
// 卖家示例（Express）
import { paymentMiddleware, x402ResourceServer } from "@x402/express"
import { ExactEvmScheme } from "@x402/evm/exact/server"
import { HTTPFacilitatorClient } from "@x402/core/server"

const server = new x402ResourceServer(
  new HTTPFacilitatorClient({ url: "https://x402.org/facilitator" })
)
server.register("eip155:*", new ExactEvmScheme())

app.use(paymentMiddleware({
  "GET /weather": {
    accepts: [{
      scheme: "exact",
      price: "$0.001",
      network: "eip155:84532",
      payTo: "0xYourWallet",
    }],
  },
}, server))
```

**关键点：**

- 卖家不需要我们的 SDK（他们用 `@x402/express` / `@x402/next` 等服务端包）
- Facilitator 负责验证签名并提交链上交易，**USDC 直接进入卖家钱包**
- 卖家不需要 KYC、不需要注册账户、不需要对接银行

### 6.4 买家付款流程是怎样的？

`pay()` 内部自动处理整个 402 支付流程：

```
① 开发者调用 pay(url, { signer })
                                    ▼
② SDK 发起 GET 请求到目标 URL
                                    ▼
③ 目标 API 返回 402 + PAYMENT-REQUIRED 头
   （包含价格、network、scheme 等信息）
                                    ▼
④ SDK 解析 PAYMENT-REQUIRED，匹配对应的 scheme
   - exact → EIP-3009 签名（固定价格）
   - upto  → Permit2 签名（授权最大金额）
                                    ▼
⑤ signer 在本地签名（不发送私钥）
                                    ▼
⑥ SDK 带 PAYMENT-SIGNATURE 头重试请求
                                    ▼
⑦ API 验证签名 → 交给 Facilitator 上链结算
                                    ▼
⑧ 返回 200 + 响应数据
```

**关键点：**

- 整个流程 **自动完成**，开发者只需一行 `pay(url, { signer })`
- 签名在本地完成，**私钥不离开当前进程或钱包**
- 如果 API 不要求支付（返回 200），SDK 直接返回数据，跳过 402 流程
- 支付失败时抛出 `XPayError`，可通过 `error.code` 区分原因

### 6.5 私钥在哪里签名？

**永远在本地**。

| 场景 | 签名位置 |
|------|----------|
| `signers.fromPrivateKey(key)` | 当前进程内，用 viem 本地签名 |
| `signers.fromMnemonic(phrase)` | 当前进程内，派生私钥后本地签名 |
| `signers.browserWallet(window.ethereum)` | 浏览器插件钱包内，用户弹窗确认 |

安全建议：
- 服务端：私钥存在环境变量或 KMS，永远不硬编码
- 浏览器：私钥永远不离开插件钱包，SDK 拿不到

### 6.6 支持哪些区块链？

x402 协议支持 7 条链，我们的 SDK 逐步接入：

| 链 | 对应 npm 包 | SDK 支持状态 | 说明 |
|--------|------------|-------------|------|
| EVM（Base, Polygon, Arbitrum, World 等） | `@x402/evm` | ✅ **v0.1** | 任何 EVM 链，USDC 自动 EIP-3009 或 Permit2 |
| Solana | `@x402/svm` | 🚧 **v0.2** | SPL Token / Token-2022 |
| Algorand | `@x402/avm` | 🔮 后续 | ASA 标准 |
| Stellar | `@x402/stellar` | 🔮 后续 | SEP-41 Soroban Token |
| Aptos | `@x402/aptos` | 🔮 后续 | Fungible Asset |
| TON | — | 🔮 后续 | TEP-74 Jetton |
| Hedera | — | 🔮 后续 | HTS Fungible Token |

**公共 Facilitator（测试网，免费）**：Base Sepolia、Solana Devnet、Stellar Testnet、Aptos Testnet
**生产 Facilitator（CDP 推荐）**：Base、Polygon、Arbitrum、World、Solana

### 6.7 如何获取测试网 USDC？

- 获取 Base Sepolia ETH: [CDP Faucet](https://faucet.circle.com/)
- 获取测试网 USDC: 同上 faucet，选择 Base Sepolia

### 6.8 服务端用 `exact` / `upto` / `batch-settlement`，SDK 都支持吗？

SDK 默认注册 `exact` + `upto` 两种 EVM scheme，自动匹配服务端要求：

- `exact` → EIP-3009，固定价格，gas 由 facilitator 赞助
- `upto` → Permit2，授权最大金额，按实际用量扣费
- `batch-settlement` → v0.1 暂不支持（需要押金通道管理），后续版本规划

开发者无需关心 scheme 差异，SDK 根据服务端 402 返回的 `scheme` 字段自动选择。

### 6.9 如何做风控和限额？

通过 `pay()` 的 `hooks` 选项：

```typescript
const result = await pay(url, {
  signer,
  hooks: {
    onBeforePayment: async ({ amount }) => {
      if (BigInt(amount) > MAX_ALLOWED) {
        return { abort: true, reason: "超限" }
      }
    },
  },
})
```

### 6.10 如何扩展支持更多 chain？

内部实现 `SignerAdapter` 接口并注册。对外只需要一个新的 `signers.*` 工厂函数。

```typescript
registerChain('aptos', {
  createScheme(signer): SchemeClient,
  networkId: 'aptos:*'
})
```

---

## 7. 参考链接

### x402 官方文档

| 文档 | 链接 |
|------|------|
| 买家快速开始 | https://docs.x402.org/getting-started/quickstart-for-buyers |
| 卖家快速开始 | https://docs.x402.org/getting-started/quickstart-for-sellers |
| 网络与 Token 支持 | https://docs.x402.org/core-concepts/network-and-token-support |
| HTTP 402 原理 | https://docs.x402.org/core-concepts/http-402 |
| Facilitator 说明 | https://docs.x402.org/core-concepts/facilitator |
| 支付方案（exact / upto / batch-settlement） | https://docs.x402.org/schemes/overview |
| exact 方案详情 | https://docs.x402.org/schemes/exact |
| upto 方案详情 | https://docs.x402.org/schemes/upto |
| batch-settlement 方案详情 | https://docs.x402.org/schemes/batch-settlement |
| 生命周期钩子 | https://docs.x402.org/advanced-concepts/lifecycle-hooks |
| Bazaar 服务发现 | https://docs.x402.org/extensions/bazaar |
| 扩展总览 | https://docs.x402.org/extensions/overview |
| EIP-2612 Gas 赞助 | https://docs.x402.org/extensions/eip2612-gas-sponsoring |
| ERC-20 Approval Gas 赞助 | https://docs.x402.org/extensions/erc20-approval-gas-sponsoring |
| 签名收据（Signed Offers & Receipts） | https://docs.x402.org/extensions/offer-receipt |
| 支付幂等性（Payment Identifier） | https://docs.x402.org/extensions/payment-identifier |
| 钱包登录（Sign-In-With-X） | https://docs.x402.org/extensions/sign-in-with-x |
| MCP Server + x402 | https://docs.x402.org/guides/mcp-server-with-x402 |
| V1 → V2 迁移指南 | https://docs.x402.org/guides/migration-v1-to-v2 |
| SDK 功能矩阵（各语言支持对比） | https://docs.x402.org/sdk-features |
| FAQ | https://docs.x402.org/faq |
| 完整 API 参考（OpenAPI） | https://docs.x402.org/api-reference/openapi.json |

### x402 协议概念

| 概念 | 链接 |
|------|------|
| x402 介绍 | https://docs.x402.org/introduction |
| Client / Server 角色 | https://docs.x402.org/core-concepts/client-server |
| Facilitator 角色 | https://docs.x402.org/core-concepts/facilitator |
| Wallet 角色 | https://docs.x402.org/core-concepts/wallet |
| x402 白皮书 | https://www.x402.org/x402-whitepaper.pdf |
| 协议规范（GitHub） | https://github.com/x402-foundation/x402/tree/main/specs |

### x402 npm 包

| 包名 | 说明 |
|------|------|
| `@x402/core` | x402 核心 client（SDK 间接依赖） |
| `@x402/fetch` | fetch 封装（SDK 依赖） |
| `@x402/axios` | Axios 封装 |
| `@x402/evm` | EVM 支付方案（SDK 依赖） |
| `@x402/svm` | Solana 支付方案 |
| `@x402/avm` | Algorand 支付方案 |
| `@x402/aptos` | Aptos 支付方案 |
| `@x402/stellar` | Stellar 支付方案 |

### 社区与工具

| 资源 | 链接 |
|------|------|
| x402 GitHub | https://github.com/x402-foundation/x402 |
| x402 Discord | https://discord.gg/cdp |
| x402 官网 | https://x402.org |
| Vercel Starter | https://vercel.com/templates/ai/x402-ai-starter |
| CDP Facilitator | https://api.cdp.coinbase.com/platform/v2/x402 |

---

## 附录 A：发布到 npm

### A.1 前置条件

1. 在 [npmjs.com](https://www.npmjs.com) 注册账号
2. 在项目中登录：`npm login`
3. 确保包名未被占用：`npm view xpaylabs-x402`

### A.2 首次发布

```bash
npm publish
```

> 注意：首次发布需要验证邮箱。

### A.3 版本更新

```bash
npm version patch  # 或 minor / major
npm run build
npm pack --dry-run
npm publish
```

### A.4 版本号规范

遵循 [SemVer](https://semver.org/):
- `0.1.x` — 初期开发版
- `0.2.x` — API 稳定后
- `1.0.0` — 正式发布

### A.5 npm 包元数据

| 字段 | 值 |
|------|-----|
| name | `xpaylabs-x402` |
| description | Simplify HTTP 402 payments with x402 protocol. Pay APIs with USDC using one line of code. |
| keywords | `x402`, `http-402`, `payment`, `usdc`, `web3`, `ethereum`, `micropayments` |
| homepage | `https://github.com/XPayLabs/XPayLabs-x402` |
| repository | `github:XPayLabs/XPayLabs-x402` |

### A.6 CI/CD

```yaml
# .github/workflows/publish.yml
name: Publish to npm
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 附录 B：roadmap

| 阶段 | 内容 | 时间 |
|------|------|------|
| v0.1 | EVM exact + upto 支持，pay()，signers.*，XPayClient，hooks | 当前 |
| v0.2 | Solana 支持（`@x402/svm`），Bazaar 服务发现 | 下一阶段 |
| v0.3 | batch-settlement 方案，生命周期钩子完善 | 后续 |
| v1.0 | 稳定 API + 完整文档 + CI/CD | 正式发布 |
