export class XPayError extends Error {
  constructor(
    message: string,
    public code: 'UNSUPPORTED_CHAIN' | 'INVALID_SIGNER' | 'PAYMENT_FAILED' | 'NETWORK_ERROR',
  ) {
    super(message)
    this.name = 'XPayError'
  }
}
