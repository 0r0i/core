import { SignerType } from '0x.js';
import { BigNumber } from 'bignumber.js';
import { expect } from 'chai';
import { FillOrders } from '../fill-order';
import { ErcDex } from '../generated/ercdex';
import { LimitOrder } from '../limit-order';
import { tokenCache } from '../token-cache';
import { RELAYER_WALLET_ADDRESS, TRADER_ADDRESS } from './utils/constants';
import { EventSink } from './utils/event-sink';
import { web3Wrapper } from './utils/web3-provider';

describe('FillOrders', () => {
  it('should be able to fill order', async () => {
    const tokenPair = await tokenCache.getTokenPair('ZRX', 'WETH');
    const minAmount = new BigNumber(tokenPair.minAmount);

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

    const taker = TRADER_ADDRESS;
    const takerReceiptSink = new EventSink(new ErcDex.Events.TakerFillReceiptChange(), { account: taker });

    const result = await new FillOrders({
      provider: web3Wrapper().getProvider(),
      taker,
      fills: [{ orderHash: order.orderHash, takerAmount: order.takerAssetAmount }],
      signerType: SignerType.Default
    }).execute();
    expect(result.status).to.equal('pending');

    await takerReceiptSink.verifyEventState(events => events.length >= 1, 'expected there to be one or more event after fill');
    await takerReceiptSink.verifyEventState(events => events[0].eventType === 'create', 'expected there to be a create event');
    await takerReceiptSink.verifyEventState(events => events.length === 2, 'expected two events');
    await takerReceiptSink.verifyEventState(events => events[1].eventType === 'success', 'expected success event');
  });
});
