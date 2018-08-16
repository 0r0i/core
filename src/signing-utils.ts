import { SignerType, ZeroEx } from '0x.js';
import { EIP712Schema, EIP712Types, EIP712Utils } from '@0xproject/order-utils';
import { Order } from '@0xproject/types';
import { BigNumber } from '@0xproject/utils';
import * as ethUtil from 'ethereumjs-util';

const EIP712_ZEROEX_TRANSACTION_SCHEMA: EIP712Schema = {
  name: 'ZeroExTransaction',
  parameters: [
    { name: 'salt', type: EIP712Types.Uint256 },
    { name: 'signerAddress', type: EIP712Types.Address },
    { name: 'data', type: EIP712Types.Bytes },
  ],
};

export const SigningUtils = {
  async signMessageAsync(
    zeroEx: ZeroEx,
    hexMessage: string,
    address: string,
    signerType: SignerType
  ) {
    return await zeroEx.ecSignOrderHashAsync(hexMessage, address, signerType);
  },
  getExecuteTransactionHex(data: string, salt: BigNumber, signerAddress: string, exchangeAddress: string): string {
    const executeTransactionData = {
      salt,
      signerAddress,
      data,
    };
    const executeTransactionHashBuff = EIP712Utils.structHash(
      EIP712_ZEROEX_TRANSACTION_SCHEMA,
      executeTransactionData,
    );
    const eip721MessageBuffer = EIP712Utils.createEIP712Message(executeTransactionHashBuff, exchangeAddress);
    return `0x${eip721MessageBuffer.toString('hex')}`;
  },
  async signExecuteTransactionHexAsync(
    zeroEx: ZeroEx,
    executeTransactionHex: string,
    signerAddress: string,
    signerType: SignerType
  ): Promise<string> {
    const eip721MessageBuffer = ethUtil.toBuffer(executeTransactionHex);
    const signature = await SigningUtils.signMessageAsync(
      zeroEx,
      '0x' + eip721MessageBuffer.toString('hex'),
      signerAddress,
      signerType
    );
    return signature;
  },
  async signOrder(params: {
    zeroEx: ZeroEx,
    makerAddress: string,
    makerAssetAddress: string,
    takerAssetAddress: string,
    senderAddress: string,
    exchangeAddress: string,
    feeRecipientAddress: string,
    makerAssetAmount: BigNumber,
    takerAssetAmount: BigNumber,
    makerFee: BigNumber,
    takerFee: BigNumber,
    expirationTimeSeconds: BigNumber,
    signerType: SignerType
  }) {
    const {
      zeroEx, makerAddress, makerAssetAddress, takerAssetAddress, senderAddress,
      exchangeAddress, feeRecipientAddress, makerAssetAmount, takerAssetAmount,
      makerFee, takerFee, expirationTimeSeconds, signerType
    } = params;

    const order: Order = {
      makerAddress,
      makerAssetData: ZeroEx.encodeERC20AssetData(makerAssetAddress),
      takerAssetData: ZeroEx.encodeERC20AssetData(takerAssetAddress),
      takerAddress: '0x0000000000000000000000000000000000000000',
      feeRecipientAddress,
      senderAddress,
      exchangeAddress,
      expirationTimeSeconds,
      makerFee,
      takerFee,
      salt: ZeroEx.generatePseudoRandomSalt(),
      makerAssetAmount,
      takerAssetAmount
    };

    const orderHash = ZeroEx.getOrderHashHex(order);
    const signature = await zeroEx.ecSignOrderHashAsync(orderHash, makerAddress, signerType);

    return {
      order,
      signature
    };
  }
};
