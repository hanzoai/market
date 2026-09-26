import { recoverAddress } from 'viem'

import { asset, chainId, contract, digest, nonce, onHanzo, payable, payment, rail, terms, type Required } from '~/lib/x402'

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

// The same, for the terms cloud names while its operator pins no token contract
// (CLOUD_X402_ASSET unset): asset "" — the zero address in the EIP-712 domain,
// which cloud's Sign (039a518e9) signs identically for "" and 0x000…0.
const LEDGER = {
  accepted: { ...CLOUD.accepted, asset: '' },
  signature:
    '0x24dd4d82f2e67fc5b4be6905fa3a628f475d622b954b8f4f15bcccc967707ae85627837b7616e52e1d3858378cef3ca10411c5a1ab709977bd94e9861342ca8200',
  authorization: { ...CLOUD.authorization, nonce: '0xab00000000000000000000000000000000000000000000000000000000000002' },
}

const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64')

describe('x402', () => {
  it('computes the digest cloud verifies', async () => {
    for (const f of [CLOUD, LEDGER, { ...LEDGER, accepted: { ...LEDGER.accepted, asset: '0x0000000000000000000000000000000000000000' } }]) {
      const signer = await recoverAddress({ hash: digest(f.accepted, f.authorization), signature: f.signature as `0x${string}` })
      expect(signer.toLowerCase()).toBe(f.authorization.from.toLowerCase())
    }
    expect(() => digest({ ...CLOUD.accepted, asset: 'usdc' }, CLOUD.authorization)).toThrow(/not a token contract/)
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

  it('signs only exact EIP-3009 in a pinned asset', () => {
    const r: Required = { x402Version: 2, resource: { url: 'job:job_1' }, accepts: [{ ...LEDGER.accepted, network: 'solana:mainnet' }, LEDGER.accepted] }
    expect(payable(r)).toBe(LEDGER.accepted)
    // Red market-19: the same USDC domain on Ethereum is another chain's money.
    const mainnet = { ...CLOUD.accepted, network: 'eip155:1', asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }
    expect(payable({ ...r, accepts: [mainnet] })).toBeNull()
    // Red market-19: on the Hanzo L1 too the asset is pinned by contract, not by name: any other contract is another token.
    expect(payable({ ...r, accepts: [CLOUD.accepted] })).toBeNull()
    expect(payable({ ...r, accepts: [{ ...LEDGER.accepted, extra: { assetTransferMethod: 'permit2', name: 'USD Coin', version: '2' } }] })).toBeNull()
    expect(payable({ ...r, accepts: [{ ...LEDGER.accepted, scheme: 'upto' }] })).toBeNull()
  })

  it('pins network → token contract → domain and scale', () => {
    const usdc = { name: 'USD Coin', version: '2', decimals: 6 }
    expect(asset(LEDGER.accepted)).toEqual(usdc)
    expect(asset({ ...LEDGER.accepted, asset: '0x0000000000000000000000000000000000000000' })).toEqual(usdc)
    expect(contract(LEDGER.accepted)).toBe('0x0000000000000000000000000000000000000000')
    expect(contract(CLOUD.accepted)).toBe(CLOUD.accepted.asset.toLowerCase())
    expect(contract({ ...CLOUD.accepted, asset: 'usdc' })).toBeNull()
    for (const other of [
      CLOUD.accepted,
      { ...LEDGER.accepted, asset: 'usdc' },
      { ...LEDGER.accepted, network: 'eip155:36962' },
      { ...LEDGER.accepted, network: 'constructor' },
      { ...LEDGER.accepted, extra: { assetTransferMethod: 'eip3009', name: 'Dai Stablecoin', version: '1' } },
      { ...LEDGER.accepted, extra: { assetTransferMethod: 'eip3009', name: 'USD Coin', version: '1' } },
      { ...LEDGER.accepted, extra: undefined },
    ])
      expect(asset(other)).toBeNull()
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
    const r: Required = { x402Version: 2, resource: { url: 'job:job_1' }, accepts: [LEDGER.accepted] }
    const sent = JSON.parse(Buffer.from(payment(r, LEDGER.accepted, LEDGER.authorization, LEDGER.signature), 'base64').toString())
    expect(sent).toEqual({
      x402Version: 2,
      resource: { url: 'job:job_1' },
      accepted: LEDGER.accepted,
      payload: { signature: LEDGER.signature, authorization: LEDGER.authorization },
    })
  })
})
