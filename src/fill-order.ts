import { BigNumber } from 'bignumber.js';
import * as Web3 from 'web3';
import { Aqueduct } from './generated/aqueduct';
import { Web3EnabledService } from './web3-enabled-service';

export interface IFillOrderParams {
  web3: Web3;
  orderHash: string;

  /**
   * The fill amount denominated in the base token
   */
  takerAmountInWei: BigNumber;
  account: string;
}

export class FillOrder extends Web3EnabledService<string> {
  constructor(private readonly params: IFillOrderParams) {
    super(params.web3);
  }

  protected async run() {
    let order: Aqueduct.Api.IStandardOrder;
    try {
      order = await new Aqueduct.Api.StandardService().getOrderByHash({
        orderHash: this.params.orderHash,
        networkId: this.networkId
      });
    } catch (err) {
      console.error(`couldn't find an order with hash ${this.params.orderHash}`);
      throw err;
    }

    if (!order) {
      throw new Error(`couldn't find an order with hash ${this.params.orderHash}`);
    }

    const signedOrder = Aqueduct.Utils.convertStandardOrderToSignedOrder(order);

    try {
      const txHash = await this.zeroEx.exchange.fillOrderAsync(signedOrder, this.params.takerAmountInWei, true, this.params.account);

      const apiKeyId = Aqueduct.getApiKeyId();
      if (apiKeyId) {
        try {
          await new Aqueduct.Api.TransactionClaimsService().claim({
            request: {
              networkId: this.networkId,
              txHash
            }
          });
        } catch (err) {
          console.error(`failed to claim txHash ${txHash}`);
          console.error(err);
        }
      }

      return txHash;
    } catch (err) {
      console.error('error filling the order');
      console.error(err);
      throw err;
    }
  }
}
