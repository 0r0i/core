import { ZeroEx } from '0x.js';
import { EIP712Schema, EIP712Types, EIP712Utils, MessagePrefixType } from '@0xproject/order-utils';
import { Order, SignatureType } from '@0xproject/types';
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
  rsvToSignature(ecSignature: ECSignature): string {
    const signatureBuffer = Buffer.concat([
      ethUtil.toBuffer(ecSignature.v),
      ethUtil.toBuffer(ecSignature.r),
      ethUtil.toBuffer(ecSignature.s),
      ethUtil.toBuffer(SignatureType.EthSign),
    ]);
    return `0x${signatureBuffer.toString('hex')}`;
  },
  async signMessageAsync(
    zeroEx: ZeroEx,
    hexMessage: string,
    address: string,
    signatureType: SignatureType,
  ) {
    if (signatureType === SignatureType.EthSign) {
      const rpcSig = await zeroEx.ecSignOrderHashAsync(hexMessage, address, {
        prefixType: MessagePrefixType.EthSign,
        shouldAddPrefixBeforeCallingEthSign: false
      });
      return this.rsvToSignature(rpcSig);
    } else {
      throw new Error(`${signatureType} is not a valid signature type`);
    }
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
    signatureType: SignatureType = SignatureType.EthSign,
  ): Promise<string> {
    const eip721MessageBuffer = ethUtil.toBuffer(executeTransactionHex);
    const signature = await SigningUtils.signMessageAsync(
      zeroEx,
      '0x' + eip721MessageBuffer.toString('hex'),
      signerAddress,
      signatureType,
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
    expirationTimeSeconds: BigNumber
  }) {
    const {
      zeroEx, makerAddress, makerAssetAddress, takerAssetAddress, senderAddress,
      exchangeAddress, feeRecipientAddress, makerAssetAmount, takerAssetAmount,
      makerFee, takerFee, expirationTimeSeconds
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
    const ecSignature = await zeroEx.ecSignOrderHashAsync(orderHash, makerAddress, {
      prefixType: MessagePrefixType.EthSign,
      shouldAddPrefixBeforeCallingEthSign: false
    });

    return {
      order,
      signature: SigningUtils.rsvToSignature(ecSignature)
    };
  }
};
