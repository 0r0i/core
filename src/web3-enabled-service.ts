import { Provider, ZeroEx } from '0x.js';
import { Web3Wrapper } from '@0xproject/web3-wrapper';

export abstract class Web3EnabledService<T> {
  protected zeroEx: ZeroEx;
  protected web3Wrapper: Web3Wrapper;

  constructor(protected readonly provider: Provider) {
    if (!provider) { throw new Error('no provider provided'); }

    this.web3Wrapper = new Web3Wrapper(provider);
  }

  public async execute() {
    this.zeroEx = new ZeroEx(this.provider, {
      networkId: await this.web3Wrapper.getNetworkIdAsync()
    });

    return await this.run();
  }

  protected abstract run(): Promise<T>;
}
