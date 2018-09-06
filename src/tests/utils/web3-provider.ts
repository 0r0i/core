import { ContractWrappers } from '0x.js';
import { MnemonicWalletSubprovider, RPCSubprovider } from '@0xproject/subproviders';
import { Web3Wrapper } from '@0xproject/web3-wrapper';

// tslint:disable-next-line
import ProviderEngine = require('web3-provider-engine');

let _web3Wrapper: Web3Wrapper;
export const web3Wrapper = () => {
  if (_web3Wrapper) { return _web3Wrapper; }

  const engine = new ProviderEngine();
  engine.addProvider(new RPCSubprovider('http://localhost:8545'));
  engine.addProvider(new MnemonicWalletSubprovider({
    mnemonic: 'concert load couple harbor equip island argue ramp clarify fence smart topic',
    baseDerivationPath: `44'/60'/0'/0`
  }));
  engine.start();

  return _web3Wrapper = new Web3Wrapper(engine);
};

export const contractWrappers = async () => {
  const networkId = await web3Wrapper().getNetworkIdAsync();
  return new ContractWrappers(web3Wrapper().getProvider(), {
    networkId
  });
};
