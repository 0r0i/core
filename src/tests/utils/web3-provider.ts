import { ZeroEx } from '0x.js';
import { MnemonicWalletSubprovider } from '@0xproject/subproviders';
import { Web3Wrapper } from '@0xproject/web3-wrapper';

// tslint:disable-next-line
import ProviderEngine = require('web3-provider-engine');
// tslint:disable-next-line
import RpcSubprovider = require('web3-provider-engine/subproviders/rpc');

let _web3Wrapper: Web3Wrapper;
export const web3Wrapper = () => {
  if (_web3Wrapper) { return _web3Wrapper; }

  const engine = new ProviderEngine();
  engine.addProvider(new RpcSubprovider({
    rpcUrl: 'http://localhost:8545'
  }));
  engine.addProvider(new MnemonicWalletSubprovider({
    mnemonic: 'concert load couple harbor equip island argue ramp clarify fence smart topic',
    baseDerivationPath: `44'/60'/0'/0`
  }));
  engine.start();

  return _web3Wrapper = new Web3Wrapper(engine);
};

let _zeroEx: ZeroEx;
export const zeroEx = async () => {
  if (_zeroEx) { return _zeroEx; }
  const wrapper = web3Wrapper();
  const networkId = await wrapper.getNetworkIdAsync();

  return new ZeroEx(web3Wrapper().getProvider(), { networkId });
};