import { Provider, SignerType } from '0x.js';
import * as ethUtil from 'ethereumjs-util';
import { ErcDex } from './generated/ercdex';
import { SigningUtils } from './signing-utils';
import { Web3EnabledService } from './web3-enabled-service';

export interface ICancelOrderParams {
  /**
   * Web3 provider engine
   */
  provider: Provider;

  /**
   * Order
   */
  order: ErcDex.Api.Order;

  signerType: SignerType;
}

/**
 * Cancel an order by orderHash; returns txHash if successful
 */
export class CancelOrder extends Web3EnabledService<ErcDex.Api.ICancelOrderResult> {
  constructor(private readonly params: ICancelOrderParams) {
    super(params.provider);

    if (!params.order) {
      throw new Error('no order provided');
    }
  }

  protected async run() {
    const results = await new ErcDex.Api.OrdersService().cancel({
      request: {
        cancellations: [
          {
            orderHash: this.params.order.orderHash,
            signature: await SigningUtils.signMessageAsync(
              this.zeroEx,
              '0x' + ethUtil.sha3(`cancel:${this.params.order.orderHash}`).toString('hex'),
              this.params.order.makerAddress,
              this.params.signerType
            )
          }
        ]
      }
    });
    return results[0];
  }
}
