import { Provider, SignerType } from '0x.js';
import { ErcDex } from './generated/ercdex';
import { SigningUtils } from './signing-utils';
import { Web3EnabledService } from './web3-enabled-service';

export interface IFillOrderParams {
  provider: Provider;

  /**
   * Collection of orders and fill amounts
   */
  fills: ErcDex.Api.IOrderFill[];

  /**
   * Account filling order
   */
  taker: string;

  signerType: SignerType;
}

export class FillOrders extends Web3EnabledService<ErcDex.Api.FillReceipt> {
  constructor(private readonly params: IFillOrderParams) {
    super(params.provider);
  }

  protected async run() {
    const quote = await new ErcDex.Api.TradeService().requestFill({
      request: {
        fills: this.params.fills,
        taker: this.params.taker
      }
    });

    const signature = await SigningUtils.signExecuteTransactionHexAsync(
      await this.zeroEx,
      quote.hex,
      this.params.taker,
      this.params.signerType
    );

    const receipt = await new ErcDex.Api.TradeService().fill({
      request: {
        quoteId: quote.id,
        signature
      }
    });

    return receipt;
  }
}
