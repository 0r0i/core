import { Order, Provider, ZeroEx } from '0x.js';
import { BigNumber } from 'bignumber.js';
import { Aqueduct } from './generated/aqueduct';
import { SigningUtils } from './signing-utils';
import { tokenCache } from './token-cache';
import { Web3EnabledService } from './web3-enabled-service';

export interface ILimitOrderParams {
  provider: Provider;

  /**
   * Limit orders can be a buy or a sell order
   */
  type: 'buy' | 'sell';

  /**
   * "ZRX" in ZRX/WETH
   */
  baseTokenSymbol: string;

  /**
   * "WETH" in ZRX/WETH
   */
  quoteTokenSymbol: string;

  /**
   * Quantity of order - MUST BE IN BASE UNITS!!!
   */
  quantityInWei: number | string | BigNumber;

  /**
   * Price
   */
  price: number | string | BigNumber;

  /**
   * Ethereum wallet address
   */
  account: string;

  /**
   * Expiration of order - defaults to Good til Canceled
   */
  expirationDate?: Date;

  /**
   * https://github.com/0xProject/0x-monorepo/pull/349
   *
   * Some signers add the personal prefix themselves, some don't
   */
  shouldAddPersonalMessagePrefix?: boolean;
}

interface IValidateParams {
  makerAssetAmount: BigNumber;
  takerAssetAmount: BigNumber;
  makerToken: Aqueduct.Api.IToken;
  takerToken: Aqueduct.Api.IToken;
  tokenPair: Aqueduct.Api.ITokenPair;
}

export const nullAddress = '0x0000000000000000000000000000000000000000';

export const denormalizedTokenPrice = (value: BigNumber, decimals: number) => {
  return value.times(new BigNumber(10).pow(18 - decimals));
};

export class LimitOrder extends Web3EnabledService<Aqueduct.Api.Order> {
  constructor(private readonly params: ILimitOrderParams) {
    super(params.provider);
  }

  protected async run() {
    const tokenPair = await tokenCache.getTokenPair(this.params.baseTokenSymbol, this.params.quoteTokenSymbol);
    const baseToken = tokenPair.assetDataA;
    const quoteToken = tokenPair.assetDataB;

    if (new BigNumber(tokenPair.minAmount).greaterThan(this.params.quantityInWei)) {
      throw new Error(`order quantity must be greater than minimum allowed amount: ${this.params.quantityInWei}/${tokenPair.minAmount}`);
    }

    if (!new BigNumber(this.params.quantityInWei).isInt()) {
      throw new Error(`order quantity must be an integer, got ${this.params.quantityInWei.toString()}`);
    }

    let makerAssetAmount: BigNumber;
    let makerToken: Aqueduct.Api.IToken;
    let takerAssetAmount: BigNumber;
    let takerToken: Aqueduct.Api.IToken;

    if (this.params.type === 'buy') {
      makerToken = quoteToken;
      takerToken = baseToken;
      takerAssetAmount = new BigNumber(this.params.quantityInWei);
      makerAssetAmount = denormalizedTokenPrice(takerAssetAmount.times(new BigNumber(this.params.price)), baseToken.decimals)
        .round();
    } else {
      makerToken = baseToken;
      takerToken = quoteToken;
      makerAssetAmount = new BigNumber(this.params.quantityInWei);
      takerAssetAmount = denormalizedTokenPrice(makerAssetAmount.times(new BigNumber(this.params.price)), baseToken.decimals)
        .round();
    }

    const zeroEx = this.zeroEx;
    const exchangeAddress = await zeroEx.exchange.getContractAddress();

    let orderConfig: Aqueduct.Api.IOrderConfig;
    try {
      orderConfig = await new Aqueduct.Api.OrdersService().getOrderConfig({
        exchangeAddress,
        makerAddress: this.params.account,
        makerAssetAmount: makerAssetAmount.toString(),
        makerAssetData: ZeroEx.encodeERC20AssetData(makerToken.address),
        takerAddress: nullAddress,
        takerAssetAmount: takerAssetAmount.toString(),
        takerAssetData: ZeroEx.encodeERC20AssetData(takerToken.address)
      });
    } catch (err) {
      console.error('failed to get order config...');
      console.log(err);
      throw err;
    }

    await this.validateRequest({
      takerAssetAmount,
      makerAssetAmount,
      makerToken,
      takerToken,
      tokenPair
    });

    const expirationTimeSeconds = new BigNumber(!this.params.expirationDate
      ? 4102444800
      : Math.floor(this.params.expirationDate.getTime() / 1000));

    const signOrderParams = {
      zeroEx,
      feeRecipientAddress: orderConfig.feeRecipientAddress,
      makerFee: new BigNumber(orderConfig.makerFee),
      takerFee: new BigNumber(orderConfig.takerFee),
      senderAddress: orderConfig.senderAddress,
      makerAddress: this.params.account,
      makerAssetAddress: makerToken.address,
      takerAssetAddress: takerToken.address,
      exchangeAddress,
      makerAssetAmount,
      takerAssetAmount,
      expirationTimeSeconds
    };

    let signatureResults: { order: Order; signature: string };
    try {
      console.log('signing order...');
      signatureResults = await SigningUtils.signOrder(signOrderParams);
    } catch (err) {
      console.error('failed to sign order');
      throw err;
    }

    try {
      const { order, signature } = signatureResults;
      const createdOrder = await new Aqueduct.Api.OrdersService().createOrder({
        request: {
          makerAddress: signOrderParams.makerAddress,
          makerAssetData: order.makerAssetData,
          takerAssetData: order.takerAssetData,
          takerAddress: order.takerAddress,
          feeRecipientAddress: order.feeRecipientAddress,
          senderAddress: order.senderAddress,
          exchangeAddress: order.exchangeAddress,
          expirationTimeSeconds: order.expirationTimeSeconds.toString(),
          makerFee: order.makerFee.toString(),
          takerFee: order.takerFee.toString(),
          salt: order.salt.toString(),
          makerAssetAmount: order.makerAssetAmount.toString(),
          takerAssetAmount: order.takerAssetAmount.toString(),
          signature
        }
      });
      return createdOrder;
    } catch (err) {
      console.error('problem posting order to API');
      console.error(err.message);
      throw err;
    }
  }

  private async validateRequest(params: IValidateParams) {
    const { makerToken, makerAssetAmount } = params;

    const zeroEx = this.zeroEx;

    await Promise.all([
      (async () => {
        const makerBalance = await zeroEx.erc20Token.getBalanceAsync(makerToken.address, this.params.account);
        if (makerBalance.lessThan(makerAssetAmount)) {
          throw new Error('insufficient token balance');
        }
      })(),
      (async () => {
        const makerAllowance = await zeroEx.erc20Token.getProxyAllowanceAsync(makerToken.address, this.params.account);
        if (makerAllowance.lessThan(makerAssetAmount)) {
          throw new Error('insufficient allowance');
        }
      })()
    ]);
  }
}
