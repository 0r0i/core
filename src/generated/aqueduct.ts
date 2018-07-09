/* tslint:disable */
import { ApiService, IAdditionalHeaders, IRequestParams } from '../api-service';
import { BigNumber } from 'bignumber.js';
import { tokenCache, TokenCache } from '../token-cache';
import { ZeroEx } from '0x.js';
const ReconnectingWebsocket = require('reconnecting-websocket');

export namespace Aqueduct {
  export let socket: WebSocket;
  let baseApiUrl: string;
  let apiKeyId: string | undefined;
  let hasWebSocket: boolean;
  let socketOpen = false;

  let subscriptions: {
    [channel: string]: {
      callbacks: Array<(data: any) => void>,
      resub: () => void,
      subActive: boolean
    } | undefined
  } = {};

  const send = (message: string, tries = 0) => {
    if (socketOpen) {
      socket.send(message);
      return;
    }

    // retry for 20 seconds
    if (tries < 20) {
      setTimeout(() => {
        send(message, tries + 1);
      }, 250);
    } else {
      console.log('failed to send');
    }
  };

  export const getApiKeyId = () => apiKeyId;

  /**
   * Initialize the Aqueduct client. Required to use the client.
   */
  export const Initialize = (params?: { host?: string; apiKeyId?: string; }) => {
    const hasProcess = typeof process !== 'undefined' && process.env;
    const host = (params && params.host) || (hasProcess && process.env.AQUEDUCT_HOST) || 'api.ercdex.com';
    baseApiUrl = `https://${host}`;

    if (params) {
      apiKeyId = params.apiKeyId;
    }

    if (hasProcess && baseApiUrl.indexOf('localhost') !== -1) {
      process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0 as any;
    }

    hasWebSocket = typeof WebSocket !== 'undefined';
    if (!hasWebSocket) {
      console.warn('No WebSocket found in global namespace; subscriptions will not be configured.');
      return;
    }

    socket = new ReconnectingWebsocket(`wss:${host}`, undefined);

    socket.onopen = () => {
      Object.keys(subscriptions).map(k => subscriptions[k]).forEach(s => {
        if (s && !s.subActive) {
          s.resub();
          s.subActive = true;
        }
      });
      socketOpen = true;
    };

    socket.onclose = () => {
      Object.keys(subscriptions).map(k => subscriptions[k]).forEach(s => {
        if (s) {
          s.subActive = false;
        }
      });
      socketOpen = false;
    };

    socket.onmessage = event => {
      try {
        const data = JSON.parse(event.data) as { channel?: string; data: any };
        if (data.channel) {
          const sub = subscriptions[data.channel];
          if (sub) {
            sub.callbacks.forEach(cb => cb(data.data));
          }
        }
      } catch(err) {
        return;
      }
    };
  };

  /**
   * Namespace representing REST API for ERC dEX
   */
  export namespace Api {

    export interface IPriceLevel {
      price: string;
      volume: string;
      volumeRatio: number;
    }

    export interface IOrderBookListing {
      priceLevels: IPriceLevel[];
    }

    export interface IAggregatedOrderData {
      sells: IOrderBookListing;
      buys: IOrderBookListing;
    }

    /**
     * Fee structure
     */
    export interface IFees {
      /**
       * Fee recipient - generally the address of the relayer
       */
      feeRecipient: string;
      /**
       * Fee owed by maker
       */
      makerFee: string;
      /**
       * Fee owed by taker
       */
      takerFee: string;
    }

    /**
     * Ethereum network description
     */
    export interface INetwork {
      /**
       * Unique identifier of network
       */
      id: number;
      /**
       * Long description of network
       */
      label: string;
      /**
       * For general, readonly querying
       */
      queryUrl: string;
    }

    /**
     * To set maintenance status from redis-cli:
set maintenance_status &quot;{ \&quot;isMaintenance\&quot;: true, \&quot;reason\&quot;: \&quot;We are currently performing maintenance on our Ethereum nodes. Service will return as soon as possible.\&quot; }&quot;

or to turn off

set maintenance_status &quot;{ \&quot;isMaintenance\&quot;: false }&quot;
Current status of app
     */
    export interface IMaintenanceStatus {
      isMaintenance: boolean;
      reason?: string;
    }

    /**
     * A notification meant for consumption by clients
     */
    export interface Notification {
      /**
       * Unique Identifier
       */
      id: number;
      /**
       * Date of creation
       */
      dateCreated: Date;
      /**
       * Date of updated
       */
      dateUpdated: Date;
      /**
       * Hex address of account associated with notification
       */
      account: string;
      /**
       * Text label of notification
       */
      label: string;
      /**
       * Date the notification expires
       */
      expirationDate: Date;
    }

    /**
     * An order that has been recorded on the ERC dEX Order Book
     */
    export interface Order {
      /**
       * Unique Identifier
       */
      id: number;
      /**
       * Date of creation
       */
      dateCreated: Date;
      /**
       * Date of updated
       */
      dateUpdated: Date;
      /**
       * Date on which the order was closed through fill, cancel, etc
       */
      dateClosed?: Date;
      /**
       * ID of the Ethereum network the order is associated with
       */
      networkId: number;
      /**
       * 0x Exchange Contract Address
       */
      exchangeContractAddress: string;
      /**
       * Unix timestamp of order expiration (in seconds)
       */
      expirationUnixTimestampSec: number;
      /**
       * Address of the fee recipient
       */
      feeRecipient: string;
      /**
       * Address of the order maker
       */
      maker: string;
      /**
       * Fee due from maker on order fill
       */
      makerFee: string;
      /**
       * Token address of the maker token
       */
      makerTokenAddress: string;
      /**
       * Total amount of maker token in order
       */
      makerTokenAmount: string;
      /**
       * Secure salt
       */
      salt: string;
      /**
       * Serialized version of the EC signature for signed orders
       */
      serializedEcSignature: string;
      /**
       * Taker address; generally a null taker
       */
      taker: string;
      /**
       * Fee due from taker on order fill
       */
      takerFee: string;
      /**
       * Token address of the taker token
       */
      takerTokenAddress: string;
      /**
       * Total amount of taker token in order
       */
      takerTokenAmount: string;
      /**
       * Remaining amount in the order in terms of taker token units
       */
      remainingTakerTokenAmount: string;
      /**
       * The hash of the signed order
       */
      orderHash: string;
      /**
       * Account ID of originator
       */
      accountId?: number;
      /**
       * State of the order: Open (0), Canceled (1),
Filled (2), Expired(3), Removed(4),
PendingCancel (5)
       */
      state: number;
      source: string;
      price: string;
      takerEvents: TakerEvent[];
      account?: Account;
    }

    export interface TakerEvent {
      /**
       * Unique Identifier
       */
      id: number;
      /**
       * Date of creation
       */
      dateCreated: Date;
      /**
       * Date of updated
       */
      dateUpdated: Date;
      /**
       * ID of the associated order
       */
      orderId: number;
      /**
       * Amount filled on the order
       */
      takerAmount: string;
      /**
       * Address of the order taker
       */
      taker: string;
      /**
       * Associated transaction hash of fill event
       */
      txHash: string;
      /**
       * State of the event: Pending(0), Complete (1), Failed (2)
       */
      state: number;
      order: Order;
    }

    export interface Account {
      /**
       * Unique Identifier
       */
      id: number;
      /**
       * Date of creation
       */
      dateCreated: Date;
      /**
       * Date of updated
       */
      dateUpdated: Date;
      name: string;
      city: string;
      state: string;
      country: string;
      address: string;
      accountType?: string;
      phoneNumber?: string;
      referrerAccountId?: number;
      referralWalletId?: number;
      isConfirmed: boolean;
      referrerAccount: Account;
      referralWallet?: AuthorizedWallet;
      users: User[];
      rebateContracts: RebateContract[];
      apiKeys: ApiKey[];
      authorizedWallets: AuthorizedWallet[];
      orders: Order[];
      transactionClaims: TransactionClaim[];
    }

    export interface AuthorizedWallet {
      /**
       * Unique Identifier
       */
      id: number;
      /**
       * Date of creation
       */
      dateCreated: Date;
      /**
       * Date of updated
       */
      dateUpdated: Date;
      /**
       * Ethereum Account Address
       */
      address: string;
      accountId: number;
      userId: number;
      account: Account;
      user: User;
    }

    export interface UserRole {
    }

    export interface User {
      /**
       * Unique Identifier
       */
      id: number;
      /**
       * Date of creation
       */
      dateCreated: Date;
      /**
       * Date of updated
       */
      dateUpdated: Date;
      email: string;
      firstName: string;
      lastName: string;
      accountId: number;
      account: Account;
      authorizedWallets: AuthorizedWallet[];
      roles: UserRole[];
    }

    export interface RebateContract {
      /**
       * Unique Identifier
       */
      id: number;
      /**
       * Date of creation
       */
      dateCreated: Date;
      /**
       * Date of updated
       */
      dateUpdated: Date;
      txHash: string;
      contractAddress: string;
      principal: string;
      partner: string;
      referrer?: string;
      networkId: number;
      accountId: number;
      account: Account;
    }

    export interface ApiKey {
      /**
       * Unique Identifier
       */
      id: number;
      /**
       * Date of creation
       */
      dateCreated: Date;
      /**
       * Date of updated
       */
      dateUpdated: Date;
      name: string;
      keyId: string;
      /**
       * ignore
       */
      secret: string;
      createdById: number;
      accountId: number;
      account: Account;
    }

    export interface TransactionClaim {
      /**
       * Unique Identifier
       */
      id: number;
      /**
       * Date of creation
       */
      dateCreated: Date;
      /**
       * Date of updated
       */
      dateUpdated: Date;
      txHash: string;
      networkId: number;
      accountId: number;
      account: Account;
    }

    export interface IMarketOrderQuote {
      totalQuantity: string;
      orders: Order[];
    }

    export interface IMarketOrderQuantityRequest {
      takerQuantity: string;
      maker: string;
      takerTokenAddress: string;
      makerTokenAddress: string;
      networkId: number;
    }

    export interface ISoftCancelOrderRequest {
      orderHash: string;
      signature: string;
    }

    export interface IDateSummary {
      date: Date;
      low?: number;
      high?: number;
      open?: number;
      close?: number;
      volume?: number;
    }

    export interface IHistoricalDataRequest {
      networkId: number;
      baseTokenAddress: string;
      quoteTokenAddress: string;
      startDate: Date;
    }

    export interface ITokenTicker {
      id: string;
      name: string;
      symbol: string;
      usdPrice: string;
      btcPrice: string;
      hourlyPercentageChange: string;
      dailyPercentageChange: string;
      weeklyPercentageChange: string;
      dailyVolume: string;
      priceEth: string;
    }

    export interface IStandardToken {
      address: string;
      minAmount: string;
      maxAmount: string;
      precision: number;
    }

    export interface IStandardTokenPair {
      tokenA: IStandardToken;
      tokenB: IStandardToken;
    }

    /**
     * Elliptic Curve Digital Signature
     */
    export interface IEcSignature {
      v: number;
      r: string;
      s: string;
    }

    export interface IStandardOrder {
      exchangeContractAddress: string;
      maker: string;
      taker: string;
      makerTokenAddress: string;
      takerTokenAddress: string;
      feeRecipient: string;
      makerTokenAmount: string;
      takerTokenAmount: string;
      makerFee: string;
      takerFee: string;
      expirationUnixTimestampSec: string;
      salt: string;
      ecSignature: IEcSignature;
      remainingTakerTokenAmount: string;
      orderHash: string;
      source: string;
    }

    export interface IStandardFeeRequest {
      maker: string;
      taker: string;
      exchangeContractAddress: string;
      makerTokenAddress: string;
      takerTokenAddress: string;
      makerTokenAmount: string;
      takerTokenAmount: string;
      expirationUnixTimestampSec: string;
      salt: string;
    }

    export interface IStandardOrderCreationRequest {
      /**
       * Order maker
       */
      maker: string;
      /**
       * Order taker; should generally be the null address (0x000...) in the case of ERC dEX
       */
      taker: string;
      /**
       * Amount of maker token in trade
       */
      makerTokenAmount: string;
      /**
       * Amount of taker token in trade
       */
      takerTokenAmount: string;
      /**
       * Fee owed by maker
       */
      makerFee: string;
      /**
       * Fee owed by taker
       */
      takerFee: string;
      /**
       * Address of maker token
       */
      makerTokenAddress: string;
      /**
       * Address of taker token
       */
      takerTokenAddress: string;
      /**
       * Secure salt
       */
      salt: string;
      /**
       * Recipient of owed fees
       */
      feeRecipient: string;
      /**
       * Address of 0x exchange contract
       */
      exchangeContractAddress: string;
      /**
       * Unix timestamp when order expires
       */
      expirationUnixTimestampSec: string;
      /**
       * Secure EC Signature
       */
      ecSignature: IEcSignature;
    }

    export interface IStandardOrderbook {
      bids: IStandardOrder[];
      asks: IStandardOrder[];
    }

    export interface IGlobalTickerRecord {
      /**
       * Base token of trade, e.g. &#x27;ZRX&#x27; in &#x27;ZRX/WETH&#x27;
       */
      baseTokenSymbol: string;
      /**
       * Quote token of trade, e.g. &#x27;WETH&#x27; in &#x27;ZRX/WETH&#x27;
       */
      quoteTokenSymbol: string;
      /**
       * Volume in base token units
       */
      baseVolume: string;
      /**
       * Volume in quote token units
       */
      quoteVolume: string;
      /**
       * Current best (lowest) ask price
       */
      ask?: string;
      /**
       * Current best (highest) bid price
       */
      bid?: string;
      /**
       * Lowest price in time period
       */
      low?: string;
      /**
       * Highest price in time period
       */
      high?: string;
      /**
       * Most recent price at beginning of time period
       */
      open?: string;
      /**
       * Most recent price
       */
      last?: string;
      /**
       * Percentage change of price in period
       */
      percentChange: string;
      /**
       * Unix timestamp of quote
       */
      timestamp: number;
    }

    export interface IToken {
      name: string;
      address: string;
      symbol: string;
      decimals: number;
    }

    export interface ITokenPair {
      tokenA: IToken;
      tokenB: IToken;
      minimumQuantity: string;
      priceDecimals: number;
      baseVolume: string;
      quoteVolume: string;
    }

    export interface TradeHistoryLog {
      /**
       * Unique Identifier
       */
      id: number;
      /**
       * Date of creation
       */
      dateCreated: Date;
      /**
       * Date of updated
       */
      dateUpdated: Date;
      /**
       * Unique, generated hash representing 0x order
       */
      orderHash: string;
      /**
       * Transaction Hash
       */
      txHash: string;
      /**
       * Ethereum Network
Mainnet: 1
Kovan: 42
       */
      networkId: number;
      /**
       * Address of order maker
       */
      maker: string;
      /**
       * Address of order taker
       */
      taker: string;
      /**
       * Address of order feeRecipient
       */
      feeRecipient: string;
      /**
       * Address of maker token
       */
      makerTokenAddress: string;
      /**
       * Symbol of maker token
       */
      makerTokenSymbol: string;
      /**
       * Name of maker token
       */
      makerTokenName: string;
      /**
       * Decimals of maker token
       */
      makerTokenDecimals: number;
      /**
       * Unit price of maker token in USD
       */
      makerTokenUsdPrice: string;
      /**
       * Address of taker token
       */
      takerTokenAddress: string;
      /**
       * Symbol of taker token
       */
      takerTokenSymbol: string;
      /**
       * Name of taker token
       */
      takerTokenName: string;
      takerTokenDecimals: number;
      /**
       * Unit price of taker token in USD
       */
      takerTokenUsdPrice: string;
      /**
       * Base amount of maker token filled in trade
       */
      filledMakerTokenAmount: string;
      /**
       * Unit amount of maker token filled in trade (adjusted for token decimals)
       */
      filledMakerTokenUnitAmount: string;
      /**
       * USD value of maker amount
       */
      filledMakerTokenAmountUsd: string;
      /**
       * Base amount of taker token filled in trade
       */
      filledTakerTokenAmount: string;
      /**
       * Unit amount of taker token filled in trade (adjusted for token decimals)
       */
      filledTakerTokenUnitAmount: string;
      /**
       * USD value of taker amount
       */
      filledTakerTokenAmountUsd: string;
      /**
       * Base amount of ZRX fees collected from maker
       */
      paidMakerFeeAmount: string;
      /**
       * Unit amount of ZRX fees collected from maker
       */
      paidMakerFeeUnitAmount: string;
      /**
       * USD value of maker fee
       */
      paidMakerFeeUsd: string;
      /**
       * Base amount of ZRX fees collected from taker
       */
      paidTakerFeeAmount: string;
      /**
       * Unit amount of ZRX fees collected from taker
       */
      paidTakerFeeUnitAmount: string;
      /**
       * USD value of taker fee
       */
      paidTakerFeeUsd: string;
      /**
       * Name of originating relayer (if known)
       */
      relayer: string;
    }

    export interface IGetTradeHistoryLogsResponse {
      page: number;
      perPage: number;
      pages: number;
      total: number;
      records: TradeHistoryLog[];
    }

    export interface IClaimTransactionRequest {
      networkId: number;
      txHash: string;
    }


    export interface IAggregatedOrdersGetParams {
      networkId: number;
      baseTokenAddress: string;
      quoteTokenAddress: string;
    }

    export interface IFeesGetParams {
      makerTokenAddress: string;
      takerTokenAddress: string;
      makerTokenAmount: string;
      takerTokenAmount: string;
      maker: string;
      taker: string;
      networkId: number;
    }

    export interface IFeesGetFeeRecipientsParams {
      networkId: number;
    }

    export interface INotificationsGetParams {
      account: string;
    }

    export interface IOrdersGetParams {
      /**
       * ID of Ethereum Network
       */
      networkId: number;
      /**
       * Address of maker token
       */
      makerTokenAddress?: string;
      /**
       * Address of taker token
       */
      takerTokenAddress?: string;
      /**
       * Use ascending sort order
       */
      isAscending?: boolean;
      /**
       * Sort order: price or dateCreated
       */
      sortOrder?: string;
      /**
       * Address of maker
       */
      maker?: string;
      /**
       * Include orders from other relayers
       */
      includeExternal?: boolean;
      isOpen?: boolean;
    }

    export interface IOrdersGetByIdParams {
      orderId: number;
    }

    export interface IOrdersGetBestParams {
      /**
       * Address of maker token
       */
      makerTokenAddress: string;
      /**
       * Address of taker token
       */
      takerTokenAddress: string;
      /**
       * Address of base token
       */
      baseTokenAddress: string;
      /**
       * Quantity of pair requested
       */
      quantity: string;
      /**
       * ID of Ethereum network
       */
      networkId: number;
      /**
       * Address of order taker
       */
      takerAddress: string;
    }

    export interface IOrdersGetMarketQuantityParams {
      params: IMarketOrderQuantityRequest;
    }

    export interface IOrdersSoftCancelOrderParams {
      request: ISoftCancelOrderRequest;
    }

    export interface IReportsGetHistoricalParams {
      request: IHistoricalDataRequest;
    }

    export interface IStandardGetTokenPairsParams {
      networkId: number;
      per_page?: number;
      page?: number;
    }

    export interface IStandardGetOrdersParams {
      networkId: number;
      per_page?: number;
      page?: number;
      exchangeContractAddress?: string;
      tokenAddress?: string;
      makerTokenAddress?: string;
      takerTokenAddress?: string;
      maker?: string;
      taker?: string;
      trader?: string;
      feeRecipient?: string;
      source?: string;
    }

    export interface IStandardGetOrderByHashParams {
      networkId: number;
      orderHash: string;
    }

    export interface IStandardGetFeesParams {
      networkId: number;
      request: IStandardFeeRequest;
    }

    export interface IStandardCreateParams {
      networkId: number;
      request: IStandardOrderCreationRequest;
    }

    export interface IStandardGetOrderbookParams {
      networkId: number;
      baseTokenAddress: string;
      quoteTokenAddress: string;
      per_page?: number;
      page?: number;
      /**
       * Origin of order. Possible values: &#x27;ercdex&#x27; | &#x27;radar-relay&#x27; | &#x27;all&#x27;
       */
      source?: string;
    }

    export interface ITakerEventsGetByTakerParams {
      /**
       * ID of Ethereum network
       */
      networkId: number;
      /**
       * Address of taker
       */
      taker: string;
    }

    export interface ITakerEventsGetByPairParams {
      /**
       * ID of Ethereum network
       */
      networkId: number;
      /**
       * Address of maker token
       */
      makerTokenAddress: string;
      /**
       * Address of taker token
       */
      takerTokenAddress: string;
      taker?: string;
    }

    export interface ITickerGetParams {
      /**
       * Ethereum Network ID
1 (mainnet - default)
42 (kovan/testnet)
       */
      networkId?: number;
      /**
       * Granularity of results
24h (1 day)
1w (1 week)
1mo (1 month)
       */
      granularity?: string;
    }

    export interface ITokenPairsGetParams {
      /**
       * ID of Ethereum network
       */
      networkId: number;
    }

    export interface ITradeHistoryLogsGetParams {
      /**
       * Ethereum Network ID (default: 1)
Mainnet: 1
Kovan: 42
       */
      network_id?: number;
      /**
       * Page number (default: 1)
       */
      page?: number;
      /**
       * Page size (max 1000, default: 20)
       */
      per_page?: number;
      /**
       * Sort order (default: &#x27;date&#x27;)
date: Sort by trade date
       */
      sort_order?: string;
      /**
       * Sort direction (default: &#x27;desc&#x27;)
asc: Ascending
desc: Descending
       */
      sort_direction?: string;
      /**
       * Name of originating 0x relayer
       */
      relayer?: string;
      /**
       * Address of order maker
       */
      maker?: string;
      /**
       * Address of order feeRecipient
       */
      fee_recipient?: string;
      /**
       * Address of maker token
       */
      maker_token_address?: string;
      /**
       * Symbol of maker token
       */
      maker_token_symbol?: string;
      /**
       * Address of order taker
       */
      taker?: string;
      /**
       * Address of taker token
       */
      taker_token_address?: string;
      /**
       * Symbol of taker token
       */
      taker_token_symbol?: string;
      /**
       * Unique, generated hash representing 0x order
       */
      order_hash?: string;
      /**
       * Address of token that is either maker or taker
       */
      token_address?: string;
      /**
       * Symbol of token that is either maker or taker
       */
      token_symbol?: string;
      /**
       * Transaction hash
       */
      tx_hash?: string;
      /**
       * Address of either maker or taker
       */
      trader?: string;
      /**
       * Minimum trade date
format (UTC): 2017-01-01T00:00:00.000Z
       */
      min_date?: Date;
      /**
       * Maximum trade date
format (UTC): 2017-01-01T00:00:00.000Z
       */
      max_date?: Date;
      /**
       * Result format (default: &#x27;json&#x27;)
options: &#x27;json&#x27;, &#x27;csv&#x27;
CSV: Page size limited to 10000 records
       */
      format?: string;
    }

    export interface ITransactionClaimsClaimParams {
      request: IClaimTransactionRequest;
    }
    export interface IAggregatedOrdersService {

      get(params: IAggregatedOrdersGetParams, headers?: IAdditionalHeaders): Promise<IAggregatedOrderData>;
    }

    export class AggregatedOrdersService extends ApiService implements IAggregatedOrdersService {

      public async get(params: IAggregatedOrdersGetParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/aggregated_orders`
        };

        requestParams.queryParameters = {
          networkId: params.networkId,
          baseTokenAddress: params.baseTokenAddress,
          quoteTokenAddress: params.quoteTokenAddress,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IAggregatedOrderData>(requestParams, headers);
      }
    }
    export interface IFeesService {

      /**
       * Get fees for an order of described parameters
       */
      get(params: IFeesGetParams, headers?: IAdditionalHeaders): Promise<IFees>;

      getFeeRecipients(params: IFeesGetFeeRecipientsParams, headers?: IAdditionalHeaders): Promise<any[]>;
    }

    export class FeesService extends ApiService implements IFeesService {

      /**
       * Get fees for an order of described parameters
       */
      public async get(params: IFeesGetParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'POST',
          url: `${baseApiUrl}/api/fees`
        };

        requestParams.queryParameters = {
          makerTokenAddress: params.makerTokenAddress,
          takerTokenAddress: params.takerTokenAddress,
          makerTokenAmount: params.makerTokenAmount,
          takerTokenAmount: params.takerTokenAmount,
          maker: params.maker,
          taker: params.taker,
          networkId: params.networkId,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IFees>(requestParams, headers);
      }

      public async getFeeRecipients(params: IFeesGetFeeRecipientsParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/fees/recipients/${params.networkId}`
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<any[]>(requestParams, headers);
      }
    }
    export interface INetworksService {

      /**
       * Get a list of supported networks
       */
      getSupported(headers?: IAdditionalHeaders): Promise<INetwork[]>;

      /**
       * Determine if app is in maintenance mode
       */
      isMaintenance(headers?: IAdditionalHeaders): Promise<IMaintenanceStatus>;
    }

    export class NetworksService extends ApiService implements INetworksService {

      /**
       * Get a list of supported networks
       */
      public async getSupported(headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/networks`
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<INetwork[]>(requestParams, headers);
      }

      /**
       * Determine if app is in maintenance mode
       */
      public async isMaintenance(headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/networks/maintenance`
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IMaintenanceStatus>(requestParams, headers);
      }
    }
    export interface INotificationsService {

      /**
       * Get active notifications for an account
       */
      get(params: INotificationsGetParams, headers?: IAdditionalHeaders): Promise<Notification[]>;
    }

    export class NotificationsService extends ApiService implements INotificationsService {

      /**
       * Get active notifications for an account
       */
      public async get(params: INotificationsGetParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/notifications`
        };

        requestParams.queryParameters = {
          account: params.account,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<Notification[]>(requestParams, headers);
      }
    }
    export interface IOrdersService {

      /**
       * Get list of orders
       */
      get(params: IOrdersGetParams, headers?: IAdditionalHeaders): Promise<Order[]>;

      getById(params: IOrdersGetByIdParams, headers?: IAdditionalHeaders): Promise<Order>;

      /**
       * Get the order(s) representing the best market price
       */
      getBest(params: IOrdersGetBestParams, headers?: IAdditionalHeaders): Promise<IMarketOrderQuote>;

      getMarketQuantity(params: IOrdersGetMarketQuantityParams, headers?: IAdditionalHeaders): Promise<string>;

      /**
       * Removes the order from the order book with a valid signature
Technically can still be filled by someone if they have the order cached elsewhere -
Do on-chain cancellation for permanent cancelation
       */
      softCancelOrder(params: IOrdersSoftCancelOrderParams, headers?: IAdditionalHeaders): Promise<void>;
    }

    export class OrdersService extends ApiService implements IOrdersService {

      /**
       * Get list of orders
       */
      public async get(params: IOrdersGetParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/orders`
        };

        requestParams.queryParameters = {
          networkId: params.networkId,
          makerTokenAddress: params.makerTokenAddress,
          takerTokenAddress: params.takerTokenAddress,
          isAscending: params.isAscending,
          sortOrder: params.sortOrder,
          maker: params.maker,
          includeExternal: params.includeExternal,
          isOpen: params.isOpen,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<Order[]>(requestParams, headers);
      }

      public async getById(params: IOrdersGetByIdParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/orders/by_id/${params.orderId}`
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<Order>(requestParams, headers);
      }

      /**
       * Get the order(s) representing the best market price
       */
      public async getBest(params: IOrdersGetBestParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/orders/best`
        };

        requestParams.queryParameters = {
          makerTokenAddress: params.makerTokenAddress,
          takerTokenAddress: params.takerTokenAddress,
          baseTokenAddress: params.baseTokenAddress,
          quantity: params.quantity,
          networkId: params.networkId,
          takerAddress: params.takerAddress,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IMarketOrderQuote>(requestParams, headers);
      }

      public async getMarketQuantity(params: IOrdersGetMarketQuantityParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'POST',
          url: `${baseApiUrl}/api/orders/market-quantity`
        };

        requestParams.body = params.params;
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<string>(requestParams, headers);
      }

      /**
       * Removes the order from the order book with a valid signature
Technically can still be filled by someone if they have the order cached elsewhere -
Do on-chain cancellation for permanent cancelation
       */
      public async softCancelOrder(params: IOrdersSoftCancelOrderParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'POST',
          url: `${baseApiUrl}/api/orders/soft-cancel`
        };

        requestParams.body = params.request;
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<void>(requestParams, headers);
      }
    }
    export interface IReportsService {

      /**
       * Get historical data for order book
       */
      getHistorical(params: IReportsGetHistoricalParams, headers?: IAdditionalHeaders): Promise<IDateSummary[]>;

      getTickerData(headers?: IAdditionalHeaders): Promise<ITokenTicker[]>;
    }

    export class ReportsService extends ApiService implements IReportsService {

      /**
       * Get historical data for order book
       */
      public async getHistorical(params: IReportsGetHistoricalParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'POST',
          url: `${baseApiUrl}/api/reports/historical`
        };

        requestParams.body = params.request;
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IDateSummary[]>(requestParams, headers);
      }

      public async getTickerData(headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/reports/ticker`
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<ITokenTicker[]>(requestParams, headers);
      }
    }
    export interface IStandardService {

      getTokenPairs(params: IStandardGetTokenPairsParams, headers?: IAdditionalHeaders): Promise<IStandardTokenPair[]>;

      getOrders(params: IStandardGetOrdersParams, headers?: IAdditionalHeaders): Promise<IStandardOrder[]>;

      getOrderByHash(params: IStandardGetOrderByHashParams, headers?: IAdditionalHeaders): Promise<IStandardOrder>;

      getFees(params: IStandardGetFeesParams, headers?: IAdditionalHeaders): Promise<IFees>;

      /**
       * Create an order
       */
      create(params: IStandardCreateParams, headers?: IAdditionalHeaders): Promise<Order>;

      getOrderbook(params: IStandardGetOrderbookParams, headers?: IAdditionalHeaders): Promise<IStandardOrderbook>;
    }

    export class StandardService extends ApiService implements IStandardService {

      public async getTokenPairs(params: IStandardGetTokenPairsParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/standard/${params.networkId}/v0/token_pairs`
        };

        requestParams.queryParameters = {
          per_page: params.per_page,
          page: params.page,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IStandardTokenPair[]>(requestParams, headers);
      }

      public async getOrders(params: IStandardGetOrdersParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/standard/${params.networkId}/v0/orders`
        };

        requestParams.queryParameters = {
          per_page: params.per_page,
          page: params.page,
          exchangeContractAddress: params.exchangeContractAddress,
          tokenAddress: params.tokenAddress,
          makerTokenAddress: params.makerTokenAddress,
          takerTokenAddress: params.takerTokenAddress,
          maker: params.maker,
          taker: params.taker,
          trader: params.trader,
          feeRecipient: params.feeRecipient,
          source: params.source,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IStandardOrder[]>(requestParams, headers);
      }

      public async getOrderByHash(params: IStandardGetOrderByHashParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/standard/${params.networkId}/v0/order/${params.orderHash}`
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IStandardOrder>(requestParams, headers);
      }

      public async getFees(params: IStandardGetFeesParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'POST',
          url: `${baseApiUrl}/api/standard/${params.networkId}/v0/fees`
        };

        requestParams.body = params.request;
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IFees>(requestParams, headers);
      }

      /**
       * Create an order
       */
      public async create(params: IStandardCreateParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'POST',
          url: `${baseApiUrl}/api/standard/${params.networkId}/v0/order`
        };

        requestParams.body = params.request;
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<Order>(requestParams, headers);
      }

      public async getOrderbook(params: IStandardGetOrderbookParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/standard/${params.networkId}/v0/orderbook`
        };

        requestParams.queryParameters = {
          baseTokenAddress: params.baseTokenAddress,
          quoteTokenAddress: params.quoteTokenAddress,
          per_page: params.per_page,
          page: params.page,
          source: params.source,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IStandardOrderbook>(requestParams, headers);
      }
    }
    export interface ITakerEventsService {

      /**
       * Get Taker Events
       */
      getByTaker(params: ITakerEventsGetByTakerParams, headers?: IAdditionalHeaders): Promise<TakerEvent[]>;

      /**
       * Get Taker Events by token pair
       */
      getByPair(params: ITakerEventsGetByPairParams, headers?: IAdditionalHeaders): Promise<TakerEvent[]>;
    }

    export class TakerEventsService extends ApiService implements ITakerEventsService {

      /**
       * Get Taker Events
       */
      public async getByTaker(params: ITakerEventsGetByTakerParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/taker-events/taker`
        };

        requestParams.queryParameters = {
          networkId: params.networkId,
          taker: params.taker,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<TakerEvent[]>(requestParams, headers);
      }

      /**
       * Get Taker Events by token pair
       */
      public async getByPair(params: ITakerEventsGetByPairParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/taker-events/pair`
        };

        requestParams.queryParameters = {
          networkId: params.networkId,
          makerTokenAddress: params.makerTokenAddress,
          takerTokenAddress: params.takerTokenAddress,
          taker: params.taker,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<TakerEvent[]>(requestParams, headers);
      }
    }
    export interface ITickerService {

      get(params: ITickerGetParams, headers?: IAdditionalHeaders): Promise<IGlobalTickerRecord[]>;
    }

    export class TickerService extends ApiService implements ITickerService {

      public async get(params: ITickerGetParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/ticker`
        };

        requestParams.queryParameters = {
          networkId: params.networkId,
          granularity: params.granularity,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IGlobalTickerRecord[]>(requestParams, headers);
      }
    }
    export interface ITokenPairsService {

      /**
       * Get a list of supported token pairs
       */
      get(params: ITokenPairsGetParams, headers?: IAdditionalHeaders): Promise<ITokenPair[]>;
    }

    export class TokenPairsService extends ApiService implements ITokenPairsService {

      /**
       * Get a list of supported token pairs
       */
      public async get(params: ITokenPairsGetParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/token-pairs/${params.networkId}`
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<ITokenPair[]>(requestParams, headers);
      }
    }
    export interface ITradeHistoryLogsService {

      get(params: ITradeHistoryLogsGetParams, headers?: IAdditionalHeaders): Promise<IGetTradeHistoryLogsResponse>;
    }

    export class TradeHistoryLogsService extends ApiService implements ITradeHistoryLogsService {

      public async get(params: ITradeHistoryLogsGetParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/trade_history_logs`
        };

        requestParams.queryParameters = {
          network_id: params.network_id,
          page: params.page,
          per_page: params.per_page,
          sort_order: params.sort_order,
          sort_direction: params.sort_direction,
          relayer: params.relayer,
          maker: params.maker,
          fee_recipient: params.fee_recipient,
          maker_token_address: params.maker_token_address,
          maker_token_symbol: params.maker_token_symbol,
          taker: params.taker,
          taker_token_address: params.taker_token_address,
          taker_token_symbol: params.taker_token_symbol,
          order_hash: params.order_hash,
          token_address: params.token_address,
          token_symbol: params.token_symbol,
          tx_hash: params.tx_hash,
          trader: params.trader,
          min_date: params.min_date,
          max_date: params.max_date,
          format: params.format,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IGetTradeHistoryLogsResponse>(requestParams, headers);
      }
    }
    export interface ITransactionClaimsService {

      claim(params: ITransactionClaimsClaimParams, headers?: IAdditionalHeaders): Promise<void>;
    }

    export class TransactionClaimsService extends ApiService implements ITransactionClaimsService {

      public async claim(params: ITransactionClaimsClaimParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'POST',
          url: `${baseApiUrl}/api/transaction-claims`
        };

        requestParams.body = params.request;
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<void>(requestParams, headers);
      }
    }
  }

  /**
   * Namespace containing socket related events
   */
  export namespace Events {
    /* tslint:disable *//**
* This file was automatically generated by json-schema-to-typescript.
* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
* and run json-schema-to-typescript to regenerate this file.
*/

export interface IPairOrderChangeEventParams {
  makerTokenAddress: string;
  takerTokenAddress: string;
  
}
/**
* This file was automatically generated by json-schema-to-typescript.
* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
* and run json-schema-to-typescript to regenerate this file.
*/

export interface IOrderChangeEventData {
  order: Order;
  eventType: ("canceled" | "created" | "expired" | "filled" | "partially-filled" | "pending-cancellation" | "pending-filled" | "pending-partially-filled" | "removed");
  reason?: string;
  
}
/**
 * An order that has been recorded on the ERC dEX Order Book
 */
export interface Order {
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateClosed?: string;
  /**
   * ID of the Ethereum network the order is associated with
   */
  networkId: number;
  /**
   * 0x Exchange Contract Address
   */
  exchangeContractAddress: string;
  /**
   * Unix timestamp of order expiration (in seconds)
   */
  expirationUnixTimestampSec: number;
  /**
   * Address of the fee recipient
   */
  feeRecipient: string;
  /**
   * Address of the order maker
   */
  maker: string;
  /**
   * Fee due from maker on order fill
   */
  makerFee: string;
  /**
   * Token address of the maker token
   */
  makerTokenAddress: string;
  /**
   * Total amount of maker token in order
   */
  makerTokenAmount: string;
  /**
   * Secure salt
   */
  salt: string;
  /**
   * Serialized version of the EC signature for signed orders
   */
  serializedEcSignature: string;
  /**
   * Taker address; generally a null taker
   */
  taker: string;
  /**
   * Fee due from taker on order fill
   */
  takerFee: string;
  /**
   * Token address of the taker token
   */
  takerTokenAddress: string;
  /**
   * Total amount of taker token in order
   */
  takerTokenAmount: string;
  /**
   * Remaining amount in the order in terms of taker token units
   */
  remainingTakerTokenAmount: string;
  /**
   * The hash of the signed order
   */
  orderHash: string;
  /**
   * Account ID of originator
   */
  accountId?: number;
  /**
   * State of the order: Open (0), Canceled (1),
   * Filled (2), Expired(3), Removed(4),
   * PendingCancel (5)
   */
  state: number;
  source: string;
  price: string;
  takerEvents: TakerEvent[];
  account?: Account;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface TakerEvent {
  /**
   * ID of the associated order
   */
  orderId: number;
  /**
   * Amount filled on the order
   */
  takerAmount: string;
  /**
   * Address of the order taker
   */
  taker: string;
  /**
   * Associated transaction hash of fill event
   */
  txHash: string;
  /**
   * State of the event: Pending(0), Complete (1), Failed (2)
   */
  state: number;
  order: Order;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface Account {
  name: string;
  city: string;
  state: string;
  country: string;
  address: string;
  accountType?: ("developer" | "market-maker" | "other" | "relayer" | "trader");
  phoneNumber?: string;
  referrerAccountId?: number;
  referralWalletId?: number;
  isConfirmed: boolean;
  referrerAccount: Account;
  referralWallet?: AuthorizedWallet;
  users: User[];
  rebateContracts: RebateContract[];
  apiKeys: ApiKey[];
  authorizedWallets: AuthorizedWallet[];
  orders: Order[];
  transactionClaims: TransactionClaim[];
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface AuthorizedWallet {
  /**
   * Ethereum Account Address
   */
  address: string;
  accountId: number;
  userId: number;
  account: Account;
  user: User;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface User {
  email: string;
  firstName: string;
  lastName: string;
  accountId: number;
  account: Account;
  authorizedWallets: AuthorizedWallet[];
  roles: ("ercdex-admin")[];
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface RebateContract {
  txHash: string;
  contractAddress: string;
  principal: string;
  partner: string;
  referrer?: string;
  networkId: number;
  accountId: number;
  account: Account;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface ApiKey {
  name: string;
  keyId: string;
  /**
   * ignore
   */
  secret: string;
  createdById: number;
  accountId: number;
  account: Account;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface TransactionClaim {
  txHash: string;
  networkId: number;
  accountId: number;
  account: Account;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
/**
* This file was automatically generated by json-schema-to-typescript.
* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
* and run json-schema-to-typescript to regenerate this file.
*/

export interface IAccountOrderChangeEventParams {
  account: string;
  
}
/**
* This file was automatically generated by json-schema-to-typescript.
* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
* and run json-schema-to-typescript to regenerate this file.
*/

export interface IAccountNotificationEventParams {
  account: string;
  
}
/**
* This file was automatically generated by json-schema-to-typescript.
* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
* and run json-schema-to-typescript to regenerate this file.
*/

export interface IAccountNotificationEventData {
  notification: Notification;
  
}
/**
 * A notification meant for consumption by clients
 */
export interface Notification {
  /**
   * Hex address of account associated with notification
   */
  account: string;
  /**
   * Text label of notification
   */
  label: string;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  expirationDate: Date;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
/**
* This file was automatically generated by json-schema-to-typescript.
* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
* and run json-schema-to-typescript to regenerate this file.
*/

export interface IPairTakerEventEventParams {
  makerTokenAddress: string;
  takerTokenAddress: string;
  
}
/**
* This file was automatically generated by json-schema-to-typescript.
* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
* and run json-schema-to-typescript to regenerate this file.
*/

export interface IPairTakerEventEventData {
  takerEvent: TakerEvent;
  eventType: ("created" | "removed" | "updated");
  
}
export interface TakerEvent {
  /**
   * ID of the associated order
   */
  orderId: number;
  /**
   * Amount filled on the order
   */
  takerAmount: string;
  /**
   * Address of the order taker
   */
  taker: string;
  /**
   * Associated transaction hash of fill event
   */
  txHash: string;
  /**
   * State of the event: Pending(0), Complete (1), Failed (2)
   */
  state: number;
  order: Order;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
/**
 * An order that has been recorded on the ERC dEX Order Book
 */
export interface Order {
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateClosed?: string;
  /**
   * ID of the Ethereum network the order is associated with
   */
  networkId: number;
  /**
   * 0x Exchange Contract Address
   */
  exchangeContractAddress: string;
  /**
   * Unix timestamp of order expiration (in seconds)
   */
  expirationUnixTimestampSec: number;
  /**
   * Address of the fee recipient
   */
  feeRecipient: string;
  /**
   * Address of the order maker
   */
  maker: string;
  /**
   * Fee due from maker on order fill
   */
  makerFee: string;
  /**
   * Token address of the maker token
   */
  makerTokenAddress: string;
  /**
   * Total amount of maker token in order
   */
  makerTokenAmount: string;
  /**
   * Secure salt
   */
  salt: string;
  /**
   * Serialized version of the EC signature for signed orders
   */
  serializedEcSignature: string;
  /**
   * Taker address; generally a null taker
   */
  taker: string;
  /**
   * Fee due from taker on order fill
   */
  takerFee: string;
  /**
   * Token address of the taker token
   */
  takerTokenAddress: string;
  /**
   * Total amount of taker token in order
   */
  takerTokenAmount: string;
  /**
   * Remaining amount in the order in terms of taker token units
   */
  remainingTakerTokenAmount: string;
  /**
   * The hash of the signed order
   */
  orderHash: string;
  /**
   * Account ID of originator
   */
  accountId?: number;
  /**
   * State of the order: Open (0), Canceled (1),
   * Filled (2), Expired(3), Removed(4),
   * PendingCancel (5)
   */
  state: number;
  source: string;
  price: string;
  takerEvents: TakerEvent[];
  account?: Account;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface Account {
  name: string;
  city: string;
  state: string;
  country: string;
  address: string;
  accountType?: ("developer" | "market-maker" | "other" | "relayer" | "trader");
  phoneNumber?: string;
  referrerAccountId?: number;
  referralWalletId?: number;
  isConfirmed: boolean;
  referrerAccount: Account;
  referralWallet?: AuthorizedWallet;
  users: User[];
  rebateContracts: RebateContract[];
  apiKeys: ApiKey[];
  authorizedWallets: AuthorizedWallet[];
  orders: Order[];
  transactionClaims: TransactionClaim[];
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface AuthorizedWallet {
  /**
   * Ethereum Account Address
   */
  address: string;
  accountId: number;
  userId: number;
  account: Account;
  user: User;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface User {
  email: string;
  firstName: string;
  lastName: string;
  accountId: number;
  account: Account;
  authorizedWallets: AuthorizedWallet[];
  roles: ("ercdex-admin")[];
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface RebateContract {
  txHash: string;
  contractAddress: string;
  principal: string;
  partner: string;
  referrer?: string;
  networkId: number;
  accountId: number;
  account: Account;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface ApiKey {
  name: string;
  keyId: string;
  /**
   * ignore
   */
  secret: string;
  createdById: number;
  accountId: number;
  account: Account;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface TransactionClaim {
  txHash: string;
  networkId: number;
  accountId: number;
  account: Account;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
/**
* This file was automatically generated by json-schema-to-typescript.
* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
* and run json-schema-to-typescript to regenerate this file.
*/

export interface IAccountTakerEventEventParams {
  account: string;
  
}
/**
* This file was automatically generated by json-schema-to-typescript.
* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
* and run json-schema-to-typescript to regenerate this file.
*/

export interface IAccountTakerEventEventData {
  takerEvent: TakerEvent;
  eventType: ("created" | "removed" | "updated");
  
}
export interface TakerEvent {
  /**
   * ID of the associated order
   */
  orderId: number;
  /**
   * Amount filled on the order
   */
  takerAmount: string;
  /**
   * Address of the order taker
   */
  taker: string;
  /**
   * Associated transaction hash of fill event
   */
  txHash: string;
  /**
   * State of the event: Pending(0), Complete (1), Failed (2)
   */
  state: number;
  order: Order;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
/**
 * An order that has been recorded on the ERC dEX Order Book
 */
export interface Order {
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateClosed?: string;
  /**
   * ID of the Ethereum network the order is associated with
   */
  networkId: number;
  /**
   * 0x Exchange Contract Address
   */
  exchangeContractAddress: string;
  /**
   * Unix timestamp of order expiration (in seconds)
   */
  expirationUnixTimestampSec: number;
  /**
   * Address of the fee recipient
   */
  feeRecipient: string;
  /**
   * Address of the order maker
   */
  maker: string;
  /**
   * Fee due from maker on order fill
   */
  makerFee: string;
  /**
   * Token address of the maker token
   */
  makerTokenAddress: string;
  /**
   * Total amount of maker token in order
   */
  makerTokenAmount: string;
  /**
   * Secure salt
   */
  salt: string;
  /**
   * Serialized version of the EC signature for signed orders
   */
  serializedEcSignature: string;
  /**
   * Taker address; generally a null taker
   */
  taker: string;
  /**
   * Fee due from taker on order fill
   */
  takerFee: string;
  /**
   * Token address of the taker token
   */
  takerTokenAddress: string;
  /**
   * Total amount of taker token in order
   */
  takerTokenAmount: string;
  /**
   * Remaining amount in the order in terms of taker token units
   */
  remainingTakerTokenAmount: string;
  /**
   * The hash of the signed order
   */
  orderHash: string;
  /**
   * Account ID of originator
   */
  accountId?: number;
  /**
   * State of the order: Open (0), Canceled (1),
   * Filled (2), Expired(3), Removed(4),
   * PendingCancel (5)
   */
  state: number;
  source: string;
  price: string;
  takerEvents: TakerEvent[];
  account?: Account;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface Account {
  name: string;
  city: string;
  state: string;
  country: string;
  address: string;
  accountType?: ("developer" | "market-maker" | "other" | "relayer" | "trader");
  phoneNumber?: string;
  referrerAccountId?: number;
  referralWalletId?: number;
  isConfirmed: boolean;
  referrerAccount: Account;
  referralWallet?: AuthorizedWallet;
  users: User[];
  rebateContracts: RebateContract[];
  apiKeys: ApiKey[];
  authorizedWallets: AuthorizedWallet[];
  orders: Order[];
  transactionClaims: TransactionClaim[];
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface AuthorizedWallet {
  /**
   * Ethereum Account Address
   */
  address: string;
  accountId: number;
  userId: number;
  account: Account;
  user: User;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface User {
  email: string;
  firstName: string;
  lastName: string;
  accountId: number;
  account: Account;
  authorizedWallets: AuthorizedWallet[];
  roles: ("ercdex-admin")[];
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface RebateContract {
  txHash: string;
  contractAddress: string;
  principal: string;
  partner: string;
  referrer?: string;
  networkId: number;
  accountId: number;
  account: Account;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface ApiKey {
  name: string;
  keyId: string;
  /**
   * ignore
   */
  secret: string;
  createdById: number;
  accountId: number;
  account: Account;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
export interface TransactionClaim {
  txHash: string;
  networkId: number;
  accountId: number;
  account: Account;
  /**
   * Unique Identifier
   */
  id: number;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateCreated: Date;
  /**
   * Enables basic storage and retrieval of dates and times.
   */
  dateUpdated: Date;
  
}
/**
* This file was automatically generated by json-schema-to-typescript.
* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
* and run json-schema-to-typescript to regenerate this file.
*/

export interface ITickerSubscriptionParams {
  
}
/**
* This file was automatically generated by json-schema-to-typescript.
* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
* and run json-schema-to-typescript to regenerate this file.
*/

export interface ITickerSubscriptionData {
  tickers: ITokenTicker[];
  
}
export interface ITokenTicker {
  id: string;
  name: string;
  symbol: string;
  usdPrice: string;
  btcPrice: string;
  hourlyPercentageChange: string;
  dailyPercentageChange: string;
  weeklyPercentageChange: string;
  dailyVolume: string;
  priceEth: string;
  
}
/**
* This file was automatically generated by json-schema-to-typescript.
* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
* and run json-schema-to-typescript to regenerate this file.
*/

export interface IAggregatedOrderFeedParams {
  baseTokenAddress: string;
  quoteTokenAddress: string;
  
}
/**
* This file was automatically generated by json-schema-to-typescript.
* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
* and run json-schema-to-typescript to regenerate this file.
*/

export interface IAggregatedOrderFeedData {
  baseTokenAddress: string;
  quoteTokenAddress: string;
  sells: IOrderBookListing;
  buys: IOrderBookListing;
  
}
export interface IOrderBookListing {
  priceLevels: IPriceLevel[];
  
}
export interface IPriceLevel {
  price: string;
  volume: string;
  volumeRatio: number;
  
}


    export interface ISocketEvent<P extends { [key: string]: any }, R> {
      subscribe(params: P, cb: (data: R) => void): this;
      unsubscribe(): void;
    }

    export abstract class SocketEvent<P extends { [key: string]: any }, R> {
      protected abstract path: string;
      private params: P;
      private callback: (data: R) => void;

      /**
       * Subscribe to this event
       * @param params Payload to submit to the server
       * @param cb Handler for event broadcasts
       */
      public subscribe(params: P, cb: (data: R) => void) {
        if (!hasWebSocket) {
          throw new Error('WebSockets not configured.');
        }

        this.params = params;
        this.callback = cb;

        const channel = this.getChannel(params);
        send(`sub:${channel}`);

        const sub = subscriptions[channel];
        if (sub) {
          sub.callbacks.push(this.callback);
        } else {
          subscriptions[channel] = {
            callbacks: [this.callback],
            resub: () => {
              send(`sub:${channel}`)
            },
            subActive: true
          };
        }

        return this;
      }

      /**
       * Dispose of an active subscription
       */
      public unsubscribe() {
        send(`unsub:${this.getChannel(this.params)}`);
        subscriptions[this.getChannel(this.params)] = undefined;
      }

      private getChannel(params: P) {
        let channel = this.path;

        Object.keys(params).forEach(k => {
          channel = channel.replace(`:${k}`, params[k]);
        });

        return channel;
      }
    }
    export interface IPairOrderChange extends ISocketEvent<IPairOrderChangeEventParams, IOrderChangeEventData> {};

    /**
     * Order changes relating to a token pair
     */
    export class PairOrderChange extends SocketEvent<IPairOrderChangeEventParams, IOrderChangeEventData> implements IPairOrderChange {
      protected path = 'pair-order-change/:makerTokenAddress/:takerTokenAddress';
    }
    export interface IAccountOrderChange extends ISocketEvent<IAccountOrderChangeEventParams, IOrderChangeEventData> {};

    /**
     * Order changes related to an account address
     */
    export class AccountOrderChange extends SocketEvent<IAccountOrderChangeEventParams, IOrderChangeEventData> implements IAccountOrderChange {
      protected path = 'account-order-change/:account';
    }
    export interface IAccountNotification extends ISocketEvent<IAccountNotificationEventParams, IAccountNotificationEventData> {};

    /**
     * Notifications related to an account address
     */
    export class AccountNotification extends SocketEvent<IAccountNotificationEventParams, IAccountNotificationEventData> implements IAccountNotification {
      protected path = 'account-notification/:account';
    }
    export interface IPairTakerEvent extends ISocketEvent<IPairTakerEventEventParams, IPairTakerEventEventData> {};

    /**
     * Taker events related to a token pair
     */
    export class PairTakerEvent extends SocketEvent<IPairTakerEventEventParams, IPairTakerEventEventData> implements IPairTakerEvent {
      protected path = 'pair-taker-event/:makerTokenAddress/:takerTokenAddress';
    }
    export interface IAccountTakerEvent extends ISocketEvent<IAccountTakerEventEventParams, IAccountTakerEventEventData> {};

    /**
     * Taker events related to an address
     */
    export class AccountTakerEvent extends SocketEvent<IAccountTakerEventEventParams, IAccountTakerEventEventData> implements IAccountTakerEvent {
      protected path = 'account-taker-event/:account';
    }
    export interface ITickerSubscription extends ISocketEvent<ITickerSubscriptionParams, ITickerSubscriptionData> {};

    /**
     * Price Ticker Updates
     */
    export class TickerSubscription extends SocketEvent<ITickerSubscriptionParams, ITickerSubscriptionData> implements ITickerSubscription {
      protected path = 'ticker';
    }
    export interface IAggregatedOrderFeed extends ISocketEvent<IAggregatedOrderFeedParams, IAggregatedOrderFeedData> {};

    /**
     * Aggregated Order Feed
     */
    export class AggregatedOrderFeed extends SocketEvent<IAggregatedOrderFeedParams, IAggregatedOrderFeedData> implements IAggregatedOrderFeed {
      protected path = 'aggregated-order-feed/:baseTokenAddress/:quoteTokenAddress';
    }
  }

  export namespace Utils {
    export interface ISignOrderParams {
      maker: string;
      taker: string;
      makerFee: BigNumber;
      takerFee: BigNumber;
      makerTokenAmount: BigNumber;
      makerTokenAddress: string;
      takerTokenAmount: BigNumber;
      takerTokenAddress: string;
      exchangeContractAddress: string;
      feeRecipient: string;
      expirationUnixTimestampSec: number;
      salt: BigNumber;
    }

    export interface IZeroExOrder {
      maker: string;
      taker: string;
      makerFee: BigNumber;
      takerFee: BigNumber;
      makerTokenAmount: BigNumber;
      takerTokenAmount: BigNumber;
      makerTokenAddress: string;
      takerTokenAddress: string;
      salt: BigNumber;
      exchangeContractAddress: string;
      feeRecipient: string;
      expirationUnixTimestampSec: BigNumber;
    }

    export interface IZeroExSignedOrder extends IZeroExOrder {
      ecSignature: Api.IEcSignature;
    }

    export const signOrder = async (zeroEx: ZeroEx, params: ISignOrderParams, shouldAddPersonalMessagePrefix = false): Promise<Aqueduct.Api.IStandardOrderCreationRequest> => {
      const order: IZeroExOrder = {
        maker: params.maker,
        taker: params.taker,
        makerFee: params.makerFee,
        takerFee: params.takerFee,
        makerTokenAmount: params.makerTokenAmount,
        takerTokenAmount: params.takerTokenAmount,
        makerTokenAddress: params.makerTokenAddress,
        takerTokenAddress: params.takerTokenAddress as string,
        salt: params.salt,
        exchangeContractAddress: params.exchangeContractAddress,
        feeRecipient: params.feeRecipient,
        expirationUnixTimestampSec: new BigNumber(params.expirationUnixTimestampSec)
      };

      const orderHash = ZeroEx.getOrderHashHex(order);
      const ecSignature = await zeroEx.signOrderHashAsync(orderHash, params.maker, shouldAddPersonalMessagePrefix);

      return {
        maker: params.maker,
        taker: order.taker,
        makerFee: params.makerFee.toString(),
        takerFee: params.takerFee.toString(),
        makerTokenAmount: params.makerTokenAmount.toString(),
        takerTokenAmount: params.takerTokenAmount.toString(),
        makerTokenAddress: params.makerTokenAddress,
        takerTokenAddress: params.takerTokenAddress,
        salt: order.salt.toString(),
        exchangeContractAddress: params.exchangeContractAddress,
        feeRecipient: params.feeRecipient,
        expirationUnixTimestampSec: order.expirationUnixTimestampSec.toString(),
        ecSignature
      };
    };

    export const convertStandardOrderToSignedOrder = (order: Aqueduct.Api.IStandardOrder): IZeroExSignedOrder => {
      return {
        ecSignature: order.ecSignature,
        exchangeContractAddress: order.exchangeContractAddress,
        expirationUnixTimestampSec: new BigNumber(order.expirationUnixTimestampSec),
        feeRecipient: order.feeRecipient,
        maker: order.maker,
        makerFee: new BigNumber(order.makerFee),
        makerTokenAddress: order.makerTokenAddress,
        makerTokenAmount: new BigNumber(order.makerTokenAmount),
        salt: new BigNumber(order.salt),
        taker: order.taker,
        takerFee: new BigNumber(order.takerFee),
        takerTokenAddress: order.takerTokenAddress,
        takerTokenAmount: new BigNumber(order.takerTokenAmount)
      };
    };

    export const convertOrderToSignedOrder = (order: Aqueduct.Api.Order): IZeroExSignedOrder => {
      return {
        ecSignature: JSON.parse(order.serializedEcSignature),
        exchangeContractAddress: order.exchangeContractAddress,
        expirationUnixTimestampSec: new BigNumber(order.expirationUnixTimestampSec),
        feeRecipient: order.feeRecipient,
        maker: order.maker,
        makerFee: new BigNumber(order.makerFee),
        makerTokenAddress: order.makerTokenAddress,
        makerTokenAmount: new BigNumber(order.makerTokenAmount),
        salt: new BigNumber(order.salt),
        taker: order.taker,
        takerFee: new BigNumber(order.takerFee),
        takerTokenAddress: order.takerTokenAddress,
        takerTokenAmount: new BigNumber(order.takerTokenAmount)
      };
    };

    export const Tokens: TokenCache = tokenCache;
  }
}
