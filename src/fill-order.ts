import { Provider } from '0x.js';
import { SignatureType } from '@0xproject/types';
import { Aqueduct } from './generated/aqueduct';
import { SigningUtils } from './signing-utils';
import { Web3EnabledService } from './web3-enabled-service';

export interface IFillOrderParams {
  provider: Provider;

  /**
   * Collection of orders and fill amounts
   */
  fills: Aqueduct.Api.IOrderFill[];

  /**
   * Account filling order
   */
  taker: string;

  shouldPrefix: boolean;
}

export class FillOrders extends Web3EnabledService<Aqueduct.Api.FillReceipt> {
  constructor(private readonly params: IFillOrderParams) {
    super(params.provider);
  }

  protected async run() {
    const quote = await new Aqueduct.Api.TradeService().requestFill({
      request: {
        fills: this.params.fills,
        taker: this.params.taker
      }
    });

    const signature = await SigningUtils.signExecuteTransactionHexAsync(
      await this.zeroEx,
      quote.hex,
      this.params.taker,
      SignatureType.EthSign,
      this.params.shouldPrefix
    );

    const receipt = await new Aqueduct.Api.TradeService().fill({
      request: {
        quoteId: quote.id,
        signature
      }
    });

    return receipt;
  }
}
