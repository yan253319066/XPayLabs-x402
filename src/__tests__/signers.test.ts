import { describe, it, expect, vi } from 'vitest'
import { signers } from '../signers/index'
import { XPayError } from '../error'

const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const PRIVATE_KEY_NO_PREFIX = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const EXPECTED_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const MNEMONIC = 'test test test test test test test test test test test junk'

describe('signers.fromPrivateKey', () => {
  it('returns a signer with chain evm', () => {
    const signer = signers.fromPrivateKey(PRIVATE_KEY)
    expect(signer.chain).toBe('evm')
  })

  it('returns correct address', () => {
    const signer = signers.fromPrivateKey(PRIVATE_KEY)
    expect(signer.address.toLowerCase()).toBe(EXPECTED_ADDRESS.toLowerCase())
  })

  it('auto-adds 0x prefix if missing', () => {
    const signer = signers.fromPrivateKey(PRIVATE_KEY_NO_PREFIX)
    expect(signer.address.toLowerCase()).toBe(EXPECTED_ADDRESS.toLowerCase())
  })

  it('provides a ClientEvmSigner via getClientEvmSigner', () => {
    const signer = signers.fromPrivateKey(PRIVATE_KEY)
    const account = signer.getClientEvmSigner()
    expect(typeof account.signTypedData).toBe('function')
  })

  it('can sign typed data', async () => {
    const signer = signers.fromPrivateKey(PRIVATE_KEY)
    const account = signer.getClientEvmSigner()
    const sig = await account.signTypedData({
      domain: { name: 'Test', version: '1', chainId: 1 },
      types: { Test: [{ name: 'value', type: 'uint256' }] },
      primaryType: 'Test',
      message: { value: 42n },
    })
    expect(sig).toMatch(/^0x[0-9a-f]{130}$/i)
  })
})

describe('signers.fromMnemonic', () => {
  it('returns a signer with chain evm', () => {
    const signer = signers.fromMnemonic(MNEMONIC)
    expect(signer.chain).toBe('evm')
  })

  it('derives the correct default address', () => {
    const signer = signers.fromMnemonic(MNEMONIC)
    expect(signer.address.toLowerCase()).toBe(EXPECTED_ADDRESS.toLowerCase())
  })

  it('throws on unsupported chain', () => {
    expect(() => signers.fromMnemonic(MNEMONIC, { chain: 'solana' as any })).toThrow(XPayError)
    expect(() => signers.fromMnemonic(MNEMONIC, { chain: 'solana' as any })).toThrow(/Unsupported chain/)
  })

  it('provides a ClientEvmSigner via getClientEvmSigner', () => {
    const signer = signers.fromMnemonic(MNEMONIC)
    const account = signer.getClientEvmSigner()
    expect(typeof account.signTypedData).toBe('function')
  })
})

describe('signers.browserWallet', () => {
  it('returns a signer with chain evm', async () => {
    const provider = { request: vi.fn().mockResolvedValue([EXPECTED_ADDRESS]) }
    const signer = await signers.browserWallet(provider)
    expect(signer.chain).toBe('evm')
  })

  it('requests accounts from provider', async () => {
    const request = vi.fn().mockResolvedValue([EXPECTED_ADDRESS])
    const provider = { request }
    const signer = await signers.browserWallet(provider)
    expect(request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' })
    expect(signer.address.toLowerCase()).toBe(EXPECTED_ADDRESS.toLowerCase())
  })

  it('signs typed data via provider', async () => {
    const request = vi.fn()
    request.mockResolvedValueOnce([EXPECTED_ADDRESS])
    request.mockResolvedValueOnce('0xdead')
    const provider = { request }
    const signer = await signers.browserWallet(provider)
    const account = signer.getClientEvmSigner()
    const sig = await account.signTypedData({
      domain: { name: 'Test', version: '1', chainId: 1 },
      types: { Test: [{ name: 'value', type: 'string' }] },
      primaryType: 'Test',
      message: { value: 'hello' },
    })
    expect(sig).toBe('0xdead')
    expect(request).toHaveBeenLastCalledWith({
      method: 'eth_signTypedData_v4',
      params: [EXPECTED_ADDRESS, expect.any(String)],
    })
  })
})
