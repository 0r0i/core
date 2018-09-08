import { SignerType } from '0x.js';
import { BigNumber } from 'bignumber.js';
import { expect } from 'chai';
import { CancelOrder } from '../cancel-order';
import { ErcDex } from '../generated/ercdex';
import { LimitOrder } from '../limit-order';
import { tokenCache } from '../token-cache';
import { DEFAULT_TX_OPTIONS, RELAYER_WALLET_ADDRESS } from './utils/constants';
import { EventSink } from './utils/event-sink';
import { shouldThrow } from './utils/should-throw';
import { contractWrappers, web3Wrapper } from './utils/web3-provider';

describe('LimitOrder', () => {
  it('should reject when using unsupported token pair', async () => {
    const err: Error = await shouldThrow(() => new LimitOrder({
      account: RELAYER_WALLET_ADDRESS,
      price: '.005',
      provider: web3Wrapper().getProvider(),
      baseTokenSymbol: 'FAKE',
      quoteTokenSymbol: 'TOKEN',
      quantityInWei: new BigNumber(1),
      type: 'buy',
      signerType: SignerType.Default
    }).execute());
    expect(err.message).to.equal('token pair not found or supported: FAKE/TOKEN');
  });

  it('should reject when quantity is below minAmount', async () => {
    const tokenPair = await tokenCache.getTokenPair('ZRX', 'WETH');
    const quantityInWei = new BigNumber(tokenPair.minAmount).minus(.1);

    const err: Error = await shouldThrow(() => new LimitOrder({
      account: RELAYER_WALLET_ADDRESS,
      price: '.005',
      provider: web3Wrapper().getProvider(),
      baseTokenSymbol: 'ZRX',
      quoteTokenSymbol: 'WETH',
      quantityInWei,
      type: 'buy',
      signerType: SignerType.Default
    }).execute());
    expect(err.message).to.equal(`order quantity must be greater than minimum allowed amount: ${quantityInWei}/${tokenPair.minAmount}`);
  });

  it('should reject when quantity is not an integer', async () => {
    const tokenPair = await tokenCache.getTokenPair('ZRX', 'WETH');
    const quantityInWei = new BigNumber(tokenPair.minAmount).plus(.1);

    const err: Error = await shouldThrow(() => new LimitOrder({
      account: RELAYER_WALLET_ADDRESS,
      price: '.005',
      provider: web3Wrapper().getProvider(),
      baseTokenSymbol: 'ZRX',
      quoteTokenSymbol: 'WETH',
      quantityInWei,
      type: 'buy',
      signerType: SignerType.Default
    }).execute());
    expect(err.message).to.equal(`order quantity must be an integer, got ${quantityInWei.toString()}`);
  });

  it('should reject when insufficient balance', async () => {
    const zrxToken = await tokenCache.getTokenBySymbol('ZRX');
    const wrappers = await contractWrappers();
    const zrxBalance = await wrappers.erc20Token.getBalanceAsync(zrxToken.address, RELAYER_WALLET_ADDRESS);

    const err: Error = await shouldThrow(() => new LimitOrder({
      account: RELAYER_WALLET_ADDRESS,
      price: '.0005',
      provider: web3Wrapper().getProvider(),
      baseTokenSymbol: 'ZRX',
      quoteTokenSymbol: 'WETH',
      quantityInWei: zrxBalance.plus(1),
      type: 'sell',
      signerType: SignerType.Default
    }).execute());
    expect(err.message).to.equal(`insufficient token balance`);
  });

  it('should reject when insufficient allowance', async () => {
    const tokenPair = await tokenCache.getTokenPair('ZRX', 'WETH');
    const minAmount = new BigNumber(tokenPair.minAmount);

    const { erc20Token } = await contractWrappers();
    await erc20Token.setProxyAllowanceAsync(tokenPair.assetDataA.address, RELAYER_WALLET_ADDRESS, new BigNumber(0), DEFAULT_TX_OPTIONS);

    const err: Error = await shouldThrow(() => new LimitOrder({
      account: RELAYER_WALLET_ADDRESS,
      price: '.0005',
      provider: web3Wrapper().getProvider(),
      baseTokenSymbol: 'ZRX',
      quoteTokenSymbol: 'WETH',
      quantityInWei: minAmount,
      type: 'sell',
      signerType: SignerType.Default
    }).execute());
    expect(err.message).to.equal(`insufficient allowance`);

    const txHash = await erc20Token.setUnlimitedProxyAllowanceAsync(tokenPair.assetDataA.address, RELAYER_WALLET_ADDRESS);
    await web3Wrapper().awaitTransactionMinedAsync(txHash);
  });

  it('should be able to create a new order', async () => {
    const tokenPair = await tokenCache.getTokenPair('ZRX', 'WETH');
    const minAmount = new BigNumber(tokenPair.minAmount);

    const accountOrderSink = new EventSink(new ErcDex.Events.AccountOrderChange(), { account: RELAYER_WALLET_ADDRESS });
    const pairOrderSink = new EventSink(new ErcDex.Events.PairOrderChange(), { baseSymbol: 'ZRX', quoteSymbol: 'WETH' });

    const order = await new LimitOrder({
      account: RELAYER_WALLET_ADDRESS,
      price: '.0005',
      provider: web3Wrapper().getProvider(),
      baseTokenSymbol: 'ZRX',
      quoteTokenSymbol: 'WETH',
      quantityInWei: minAmount,
      type: 'sell',
      signerType: SignerType.Default
    }).execute();
    expect(order.price).to.equal('0.0005');

    await Promise.all([
      accountOrderSink.verifyEventState(events => events.length === 1, 'expected to have one event after creating an order'),
      accountOrderSink.verifyEventState(events => events[0] && events[0].eventType === 'created', 'expected event to be type created'),
      pairOrderSink.verifyEventState(events => events.length === 1, 'expected to have one event after creating an order'),
      pairOrderSink.verifyEventState(events => events[0] && events[0].eventType === 'created', 'expected event to be type created')
    ]);

    // cancel the order
    const result = await new CancelOrder({
      orderHash: order.orderHash,
      account: order.makerAddress,
      provider: web3Wrapper().getProvider(),
      signerType: SignerType.Default
    }).execute();
    expect(result.orderHash).to.equal(order.orderHash);
    expect(result.success).to.equal(true);

    await Promise.all([
      accountOrderSink.verifyEventState(events => events.length === 2, 'expected to have two events after canceling an order'),
      accountOrderSink.verifyEventState(events => events[1] && events[1].eventType === 'canceled', 'expected event to be type canceled'),
      pairOrderSink.verifyEventState(events => events.length === 2, 'expected to have two events after canceling an order'),
      pairOrderSink.verifyEventState(events => events[1] && events[1].eventType === 'canceled', 'expected event to be type canceled')
    ]);
  });
});
