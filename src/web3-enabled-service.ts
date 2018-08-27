import { ContractWrappers, ExchangeWrapper } from '@0xproject/contract-wrappers';
import { Provider, Web3Wrapper } from '@0xproject/web3-wrapper';

export abstract class Web3EnabledService<T> {
  protected web3Wrapper: Web3Wrapper;
  protected contractWrappers: ContractWrappers;
  protected exchangeWrapper: ExchangeWrapper;

  constructor(protected readonly provider: Provider) {
    if (!provider) { throw new Error('no provider provided'); }

    this.web3Wrapper = new Web3Wrapper(provider);
  }

  public async execute() {
    const networkId = await this.web3Wrapper.getNetworkIdAsync();

    this.contractWrappers = new ContractWrappers(this.web3Wrapper.getProvider(), { networkId });
    this.exchangeWrapper = new ExchangeWrapper(this.web3Wrapper, networkId);

    return await this.run();
  }

  protected abstract run(): Promise<T>;
}
