import { SignerType } from '0x.js';
import {
  assetDataUtils, generatePseudoRandomSalt, orderHashUtils, Provider, signatureUtils
} from '@0xproject/order-utils';
import { Order } from '@0xproject/types';
import { BigNumber } from '@0xproject/utils';

export interface ISignOrderParams {
  provider: Provider;
  makerAddress: string;
  makerAssetAddress: string;
  takerAssetAddress: string;
  senderAddress: string;
  exchangeAddress: string;
  feeRecipientAddress: string;
  makerAssetAmount: BigNumber;
  takerAssetAmount: BigNumber;
  makerFee: BigNumber;
  takerFee: BigNumber;
  expirationTimeSeconds: BigNumber;
  signerType: SignerType;
}

export const SigningUtils = {
  async signMessageAsync(
    provider: Provider,
    hexMessage: string,
    address: string,
    signerType: SignerType
  ) {
    return await signatureUtils.ecSignOrderHashAsync(provider, hexMessage, address, signerType);
  },
  async signExecuteTx(
    provider: Provider,
    executeTransactionHex: string,
    signerAddress: string,
    signerType: SignerType
  ): Promise<string> {
    return await signatureUtils.ecSignOrderHashAsync(
      provider,
      executeTransactionHex,
      signerAddress,
      signerType
    );
  },
  async signOrder(params: ISignOrderParams) {
    const {
      makerAddress, makerAssetAddress, takerAssetAddress, senderAddress,
      exchangeAddress, feeRecipientAddress, makerAssetAmount, takerAssetAmount,
      makerFee, takerFee, expirationTimeSeconds, signerType, provider
    } = params;

    const order: Order = {
      makerAddress,
      makerAssetData: assetDataUtils.encodeERC20AssetData(makerAssetAddress),
      takerAssetData: assetDataUtils.encodeERC20AssetData(takerAssetAddress),
      takerAddress: '0x0000000000000000000000000000000000000000',
      feeRecipientAddress,
      senderAddress,
      exchangeAddress,
      expirationTimeSeconds,
      makerFee,
      takerFee,
      salt: generatePseudoRandomSalt(),
      makerAssetAmount,
      takerAssetAmount
    };

    const orderHash = orderHashUtils.getOrderHashHex(order);
    const signature = await signatureUtils.ecSignOrderHashAsync(provider, orderHash, makerAddress, signerType);

    return {
      order,
      signature
    };
  }
};
