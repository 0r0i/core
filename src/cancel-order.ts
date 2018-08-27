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
   * Order hash
   */
  orderHash: string;

  account: string;

  signerType: SignerType;
}

/**
 * Cancel an order by orderHash; returns txHash if successful
 */
export class CancelOrder extends Web3EnabledService<ErcDex.Api.ICancelOrderResult> {
  constructor(private readonly params: ICancelOrderParams) {
    super(params.provider);

    if (!params.orderHash) {
      throw new Error('no orderHash provided');
    }
  }

  protected async run() {
    const results = await new ErcDex.Api.OrdersService().cancel({
      request: {
        cancellations: [
          {
            orderHash: this.params.orderHash,
            signature: await SigningUtils.signMessageAsync(
              this.provider,
              '0x' + ethUtil.sha3(`cancel:${this.params.orderHash}`).toString('hex'),
              this.params.account,
              this.params.signerType
            )
          }
        ]
      }
    });
    return results[0];
  }
}
