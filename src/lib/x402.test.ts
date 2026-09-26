import { recoverAddress } from 'viem'

import { chainId, digest, nonce, onHanzo, payable, payment, places, rail, terms, type Required } from '~/lib/x402'

// A payment signed by cloud's own client half, apps/x402.Sign at hanzo-inc/cloud
// 725e61052, for these exact inputs, and accepted by its Verify. The digest this
// file computes must recover the same signer, or the rail refuses every payment
// this storefront signs.
const CLOUD = {
  accepted: {
    scheme: 'exact',
    network: 'eip155:36963',
    amount: '250000000',
    asset: '0x5425890298aed601595a70AB815c96711a31Bc65',
    payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
    maxTimeoutSeconds: 300,
    extra: { assetTransferMethod: 'eip3009', name: 'USD Coin', version: '2' },
  },
  signature:
    '0x0f52de9584f9edea709fd2841e96f2fdf416cb52917526c47330197e274cab1034644bb319f5016c9ae9608523fd9a9ec7d02af3b17a3effd83e1aca4628d19500',
  authorization: {
    from: '0x2c7536E3605D9C16a7a3D7b1898e529396a65c23',
    to: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
    value: '250000000',
    validAfter: '1700000000',
    validBefore: '1702592000',
    nonce: '0xab00000000000000000000000000000000000000000000000000000000000001',
  },
}

const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64')

describe('x402', () => {
  it('computes the digest cloud verifies', async () => {
    const h = digest(CLOUD.accepted, CLOUD.authorization)
    const signer = await recoverAddress({ hash: h, signature: CLOUD.signature as `0x${string}` })
    expect(signer.toLowerCase()).toBe(CLOUD.authorization.from.toLowerCase())
  })

  it('reads the terms from a 402 problem document', () => {
    const required: Required = { x402Version: 2, resource: { url: 'job:job_1' }, accepts: [CLOUD.accepted] }
    expect(terms({ status: 402, paymentRequired: b64(required) })).toEqual(required)
    expect(terms({ status: 402 })).toBeNull()
    expect(terms(undefined)).toBeNull()
    expect(terms({ paymentRequired: 'not base64 json' })).toBeNull()
    expect(terms({ paymentRequired: b64({ ...required, x402Version: 1 }) })).toBeNull()
    expect(terms({ paymentRequired: b64({ x402Version: 2, accepts: [] }) })).toBeNull()
  })

  it('signs only exact EIP-3009 on the Hanzo L1', () => {
    const r: Required = { x402Version: 2, resource: { url: 'job:job_1' }, accepts: [{ ...CLOUD.accepted, network: 'solana:mainnet' }, CLOUD.accepted] }
    expect(payable(r)).toBe(CLOUD.accepted)
    // Red market-19: the same USDC domain on Ethereum is another chain's money.
    const mainnet = { ...CLOUD.accepted, network: 'eip155:1', asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }
    expect(payable({ ...r, accepts: [mainnet] })).toBeNull()
    expect(places(mainnet)).toBeNull()
    expect(payable({ ...r, accepts: [{ ...CLOUD.accepted, extra: { assetTransferMethod: 'permit2', name: 'USD Coin', version: '2' } }] })).toBeNull()
    expect(payable({ ...r, accepts: [{ ...CLOUD.accepted, scheme: 'upto' }] })).toBeNull()
  })

  it('signs only an asset whose scale it knows: USDC, 6 places', () => {
    const r: Required = { x402Version: 2, resource: { url: 'job:job_1' }, accepts: [CLOUD.accepted] }
    expect(places(CLOUD.accepted)).toBe(6)
    const other = { ...CLOUD.accepted, extra: { assetTransferMethod: 'eip3009', name: 'Dai Stablecoin', version: '1' } }
    expect(places(other)).toBeNull()
    expect(payable({ ...r, accepts: [other] })).toBeNull()
    expect(places({ ...CLOUD.accepted, extra: undefined })).toBeNull()
  })

  it('pays only from a wallet on the Hanzo L1, as cloud stores its chain', () => {
    for (const chain of [undefined, '', '  ', 'eip155:36963', '36963']) expect(onHanzo(chain)).toBe(true)
    for (const chain of ['eip155:1', '1', '8453', 'eip155:369630', 'lux', 'solana:mainnet']) expect(onHanzo(chain)).toBe(false)
    expect(() => rail({ id: 'wal_acme', chain: '36963' })).not.toThrow()
    expect(() => rail({ id: 'wal_eth', chain: 'eip155:1' })).toThrow('Wallet wal_eth is for eip155:1, and this storefront pays only on the Hanzo L1 (eip155:36963). Nothing was signed.')
    expect(() => rail({ chain: 'lux' })).toThrow(/^The wallet is for lux/)
  })

  it('names the chain and draws a fresh nonce', () => {
    expect(chainId('eip155:36963')).toBe(36963)
    expect(() => chainId('solana:mainnet')).toThrow(/not an EVM chain/)
    const a = nonce()
    expect(a).toMatch(/^0x[0-9a-f]{64}$/)
    expect(nonce()).not.toBe(a)
  })

  it('encodes the payment the rail parses', () => {
    const r: Required = { x402Version: 2, resource: { url: 'job:job_1' }, accepts: [CLOUD.accepted] }
    const sent = JSON.parse(Buffer.from(payment(r, CLOUD.accepted, CLOUD.authorization, CLOUD.signature), 'base64').toString())
    expect(sent).toEqual({
      x402Version: 2,
      resource: { url: 'job:job_1' },
      accepted: CLOUD.accepted,
      payload: { signature: CLOUD.signature, authorization: CLOUD.authorization },
    })
  })
})
