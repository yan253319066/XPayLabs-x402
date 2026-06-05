export class XPayError extends Error {
  constructor(
    message: string,
    public code:
      | 'UNSUPPORTED_CHAIN'
      | 'INVALID_SIGNER'
      | 'PAYMENT_FAILED'
      | 'NETWORK_ERROR'
      | 'SIGNER_REQUIRED'
      | 'CHAIN_NOT_SUPPORTED'
      | 'NO_VALID_SCHEME'
      | 'HOOK_ABORTED',
  ) {
    super(message)
    this.name = 'XPayError'
  }
}
