/* tslint:disable */
import { ApiService, IAdditionalHeaders, IRequestParams } from '../api-service';
import ReconnectingWebsocket from 'reconnecting-websocket';

export namespace ErcDex {
  export let socket: ReconnectingWebsocket;
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
  export const Initialize = (params?: { host?: string; apiKeyId?: string; clientId?: string; }) => {
    const hasProcess = typeof process !== 'undefined' && process.env;
    const host = (params && params.host) || (hasProcess && process.env.AQUEDUCT_HOST) || 'app.ercdex.com';
    baseApiUrl = `https://${host}`;

    if (params) {
      apiKeyId = params.apiKeyId;
    }

    if (hasProcess && baseApiUrl.indexOf('localhost') !== -1) {
      process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0 as any;
    }

    hasWebSocket = typeof WebSocket !== 'undefined';
    if (!hasWebSocket) {
      return;
    }

    let wsEndpoint = `wss:${host}` + '/ws';
    if (params && params.clientId) {
      wsEndpoint += '?client_id=' + params.clientId;
    }
    socket = new ReconnectingWebsocket(wsEndpoint, undefined);

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

    export interface IToken {
      name: string;
      address: string;
      symbol: string;
      decimals: number;
    }

    export interface ITokenPair {
      assetDataA: IToken;
      assetDataB: IToken;
      minAmount: string;
      maxAmount: string;
      precision: number;
      baseVolume: string;
      quoteVolume: string;
    }

    export interface IGetAssetPairsResponse {
      total: number;
      page: number;
      perPage: number;
      records: ITokenPair[];
    }

    export interface INetwork {
      id: number;
      label: string;
      url: string;
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

    export interface ISource {
      domain: string;
      title: string;
      region: string;
      path: string;
    }

    export interface ICurrency {
      code: string;
      title: string;
      slug: string;
      url: string;
    }

    export interface IVotes {
      negative: number;
      positive: number;
      important: number;
      liked: number;
      disliked: number;
      lol: number;
      toxic: number;
      saved: number;
    }

    export interface IResult {
      domain: string;
      source: ISource;
      title: string;
      published_at: Date;
      slug: string;
      currencies: ICurrency[];
      id: number;
      created_at: Date;
      url: string;
      votes: IVotes;
    }

    export interface ICryptoPanicPostsResponse {
      count: number;
      next: string;
      previous?: any;
      results: IResult[];
    }

    export interface NewsItem {
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
      url: string;
      title: string;
      description: string;
      featured: boolean;
      source: string;
    }

    export interface IGetNewsItemsResponse {
      total: number;
      page: number;
      perPage: number;
      records: NewsItem[];
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
       * 0x Exchange Contract Address
       */
      exchangeAddress: string;
      /**
       * Unix timestamp of order expiration (in seconds)
       */
      expirationTimeSeconds: string;
      /**
       * Address of the fee recipient
       */
      feeRecipientAddress: string;
      /**
       * Address of the order maker
       */
      makerAddress: string;
      /**
       * Fee due from maker on order fill
       */
      makerFee: string;
      /**
       * Token address of the maker token
       */
      makerAssetAddress: string;
      /**
       * Encoded maker asset data
       */
      makerAssetData: string;
      /**
       * Encoded taker asset data
       */
      takerAssetData: string;
      /**
       * Total amount of maker token in order
       */
      makerAssetAmount: string;
      /**
       * Secure salt
       */
      salt: string;
      /**
       * Serialized version of the EC signature for signed orders
       */
      signature: string;
      /**
       * Taker address; generally a null taker
       */
      takerAddress: string;
      /**
       * Fee due from taker on order fill
       */
      takerFee: string;
      /**
       * Token address of the taker token
       */
      takerAssetAddress: string;
      /**
       * Total amount of taker token in order
       */
      takerAssetAmount: string;
      /**
       * Remaining amount that can be filled in taker tokens
       */
      remainingFillableTakerAmount: string;
      /**
       * Remaining amount that can be filled in maker tokens
       */
      remainingFillableMakerAmount: string;
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
Filled (2), Expired(3), Removed(4)
       */
      state: number;
      price: string;
      senderAddress: string;
      system: boolean;
      account?: Account;
    }

    export interface IOrderCreationRequest {
      /**
       * Order maker
       */
      makerAddress: string;
      /**
       * Order taker; should generally be the null address (0x000...) in the case of ERC dEX
       */
      takerAddress: string;
      /**
       * Recipient of owed fees
       */
      feeRecipientAddress: string;
      /**
       * Required order sender
       */
      senderAddress: string;
      /**
       * Amount of maker token in trade
       */
      makerAssetAmount: string;
      /**
       * Amount of taker token in trade
       */
      takerAssetAmount: string;
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
      makerAssetData: string;
      /**
       * Address of taker token
       */
      takerAssetData: string;
      /**
       * Secure salt
       */
      salt: string;
      /**
       * Address of 0x exchange contract
       */
      exchangeAddress: string;
      /**
       * Unix timestamp when order expires
       */
      expirationTimeSeconds: string;
      /**
       * Secure EC Signature
       */
      signature: string;
    }

    export interface IOrderData {
      order: Order;
    }

    export interface IGetOrdersResponse {
      total: number;
      page: number;
      perPage: number;
      records: IOrderData[];
    }

    export interface IOrderConfig {
      senderAddress: string;
      feeRecipientAddress: string;
      makerFee: string;
      takerFee: string;
    }

    export interface IFeeRecipientsResponse {
      total: number;
      page: number;
      perPage: number;
      records: any[];
    }

    export interface IOrderbookSide {
      total: number;
      page: number;
      perPage: number;
      records: IOrderData[];
    }

    export interface IOrderbookResponse {
      bids: IOrderbookSide;
      asks: IOrderbookSide;
    }

    export interface ICancelOrderResult {
      orderHash: string;
      success: boolean;
      message: string;
    }

    export interface ICancelOrderData {
      /**
       * Computed unique order hash
       */
      orderHash: string;
      /**
       * Signed message indicating intent to cancel. Sign a hex of a message with format &#x60;cancel:ORDER_HASH_GOES_HERE&#x60;
       */
      signature: string;
    }

    export interface ICancelOrdersRequest {
      cancellations: ICancelOrderData[];
    }

    export interface ITokenTicker {
      symbol: string;
      usdPrice: string;
      dailyPercentageChange: string;
      dailyVolume: string;
      priceEth: string;
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

    export interface ITokenRequestRequest {
      symbol: string;
      email?: string;
      message?: string;
    }

    export interface FillReceipt {
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
      taker: string;
      /**
       * Receipt status: success | error | pending
       */
      status: string;
      baseAssetAddress: string;
      baseSymbol: string;
      quoteSymbol: string;
      quoteAssetAddress: string;
      logs?: FillReceiptLog[];
    }

    export interface FillReceiptLog {
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
      orderId: number;
      receiptId: number;
      makerAddress: string;
      side: string;
      takerAmount: string;
      makerAmount: string;
      price: string;
      isFeeOrder: boolean;
      receipt?: FillReceipt;
    }

    export interface IFillRequest {
      /**
       * ID of a provided quote
       */
      quoteId: number;
      /**
       * Signed transaction hash
       */
      signature: string;
    }

    export interface MarketQuoteFill {
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
       * Computed hash verifying the authenticity of the order
       */
      orderId: number;
      /**
       * Computed hash verifying the authenticity of the order
       */
      quoteId: number;
      /**
       * Computed hash verifying the authenticity of the order
       */
      orderHash: string;
      /**
       * Taker amount in base units to fill from this order
       */
      takerAmount: string;
    }

    export interface MarketQuote {
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
       * Unique salt
       */
      salt: string;
      /**
       * Pre-calculated hex to sign
       */
      hex: string;
      /**
       * Order taker
       */
      takerAddress: string;
      /**
       * Computed average price
       */
      price: string;
      /**
       * Total taker amount
       */
      takerAmount: string;
      /**
       * Total maker amount
       */
      makerAmount: string;
      /**
       * Address of taker token
       */
      takerAssetAddress: string;
      /**
       * Expiration - unix timestamp in seconds
       */
      expiration: number;
      /**
       * Symbol of the token used to pay fees
       */
      feeTokenSymbol: string;
      /**
       * Amount of fees paid in wei
       */
      feeAmount: string;
      /**
       * Amount of fees paid to cover network fees in wei
       */
      networkFeeAmount: string;
      /**
       * State of the quote (Open [0], Expired [1], Invalid [2], Redeemed [3])
       */
      state: number;
      /**
       * ID of order used to pay fees
       */
      feeOrderId?: number;
      /**
       * Order used to pay fees
       */
      feeOrder?: Order;
      /**
       * Collection of fills
       */
      fills: MarketQuoteFill[];
    }

    export interface IOrderFill {
      /**
       * Computed hash verifying the authenticity of the order
       */
      orderHash: string;
      /**
       * Taker amount in base units to fill from this order
       */
      takerAmount: string;
    }

    export interface IRequestFillRequest {
      /**
       * Account requesting the trade
       */
      taker: string;
      /**
       * Collection of trade requests
       */
      fills: IOrderFill[];
    }

    export interface IMarketOrderQuote {
      quote: MarketQuote;
      /**
       * Can only provide a partial quote
       */
      isPartial: boolean;
    }

    export interface IGetMarketOrderQuoteRequest {
      /**
       * Wallet address of intended taker
       */
      takerAddress: string;
      /**
       * Token pair in BASE/QUOTE format
       */
      pair: string;
      /**
       * Trade side: buy or sell
       */
      side: string;
      /**
       * Quantity in wei of base token to buy/sell
       */
      quantity: string;
    }

    export interface IGetMarketOrderQuoteByPercentageRequest {
      /**
       * Wallet address of intended taker
       */
      takerAddress: string;
      /**
       * Token pair in BASE/QUOTE format
       */
      pair: string;
      /**
       * Trade side: &#x27;buy&#x27; or &#x27;sell&#x27;
       */
      side: string;
      /**
       * Percentage (integer, 1-100)
       */
      percentage: number;
    }

    export interface IGetReceiptsResponse {
      total: number;
      page: number;
      perPage: number;
      records: FillReceipt[];
    }

    export interface ITradingViewLog {
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume?: number;
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
       * Address of order maker
       */
      makerAddress: string;
      /**
       * Address of order taker
       */
      takerAddress: string;
      /**
       * Address of order feeRecipient
       */
      feeRecipientAddress: string;
      /**
       * Address of maker token
       */
      makerAssetAddress: string;
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
      takerAssetAddress: string;
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


    export interface IAggregatedOrdersGetParams {
      baseSymbol: string;
      quoteSymbol: string;
    }

    export interface IAssetPairsGetParams {
      page?: number;
      perPage?: number;
    }

    export interface INewsGetCryptoPanicParams {
      symbol: string;
    }

    export interface INewsGetErcDexParams {
      page?: number;
      perPage?: number;
    }

    export interface INotificationsGetParams {
      account: string;
    }

    export interface IOrdersCreateOrderParams {
      request: IOrderCreationRequest;
    }

    export interface IOrdersGetOrderByIdParams {
      orderId: number;
    }

    export interface IOrdersGetParams {
      /**
       * Include orders that are open; if false, only closed orders are returned
       */
      open?: boolean;
      /**
       * Page number
       */
      page?: number;
      /**
       * Page size
       */
      perPage?: number;
      /**
       * 0x contract exchange address
       */
      exchangeAddress?: string;
      /**
       * Fee recipient address
       */
      feeRecipientAddress?: string;
      /**
       * Encoded taker asset data
       */
      takerAssetData?: string;
      /**
       * Encoded maker asset data
       */
      makerAssetData?: string;
      /**
       * Designated address to execute orders
       */
      senderAddress?: string;
      /**
       * Encoded asset data (could be maker or taker)
       */
      traderAssetData?: string;
      /**
       * Trader address (could be makerAddress or takerAddress)
       */
      traderAddress?: string;
      /**
       * Token address of taker asset
       */
      takerAssetAddress?: string;
      /**
       * Address of order taker
       */
      takerAddress?: string;
      /**
       * Token address of maker asset
       */
      makerAssetAddress?: string;
      /**
       * Address of order maker
       */
      makerAddress?: string;
      /**
       * Maker asset proxy ID (ERC20 proxy only
       */
      makerAssetProxyId?: string;
      /**
       * Taker asset proxy ID (ERC20 proxy only)
       */
      takerAssetProxyId?: string;
      pair?: string;
    }

    export interface IOrdersGetOrderByHashParams {
      /**
       * Hex format hash of order parameters
       */
      orderHash: string;
    }

    export interface IOrdersGetOrderConfigParams {
      makerAddress: string;
      takerAddress: string;
      makerAssetAmount: string;
      takerAssetAmount: string;
      makerAssetData: string;
      takerAssetData: string;
      exchangeAddress: string;
    }

    export interface IOrdersGetOrderbookParams {
      baseAssetData: string;
      quoteAssetData: string;
      perPage?: number;
      page?: number;
    }

    export interface IOrdersCancelParams {
      request: ICancelOrdersRequest;
    }

    export interface ITickerGetParams {
      /**
       * Granularity of results: 24h (1 day), 1w (1 week), 1mo (1 month)
       */
      granularity?: string;
    }

    export interface ITokenRequestCreateParams {
      request: ITokenRequestRequest;
    }

    export interface ITradeFillParams {
      request: IFillRequest;
    }

    export interface ITradeRequestFillParams {
      request: IRequestFillRequest;
    }

    export interface ITradeGetMarketQuoteParams {
      request: IGetMarketOrderQuoteRequest;
    }

    export interface ITradeGetMarketQuoteByPercentParams {
      request: IGetMarketOrderQuoteByPercentageRequest;
    }

    export interface ITradeGetReceiptParams {
      id: number;
    }

    export interface ITradeGetReceiptsParams {
      /**
       * Page
       */
      page?: number;
      /**
       * Page size
       */
      perPage?: number;
      /**
       * Optionally provide wallet address of receipt recipient
       */
      taker_address?: string;
      /**
       * The token pair in the format BASE/QUOTE, e.g. ZRX/WETH
       */
      pair?: string;
      /**
       * Optionally provide wallet address of order maker
       */
      maker_address?: string;
      orderId?: number;
    }

    export interface ITradingViewGetLogsParams {
      pair: string;
      resolution: string;
      startDate: Date;
      endDate: Date;
    }

    export interface ITradeHistoryLogsGetParams {
      /**
       * Page number (default: 1)
       */
      page?: number;
      /**
       * Page size (max 1000, default: 20)
       */
      per_page?: number;
      /**
       * Sort order (default: &#x27;date&#x27;). date: Sort by trade date
       */
      sort_order?: string;
      /**
       * Sort direction (default: &#x27;desc&#x27;). Options: asc: Ascending, desc: Descending
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
       * Minimum trade date: format (UTC): 2017-01-01T00:00:00.000Z
       */
      min_date?: Date;
      /**
       * Maximum trade date. Format (UTC): 2017-01-01T00:00:00.000Z
       */
      max_date?: Date;
      /**
       * Result format (default: &#x27;json&#x27;). Options: &#x27;json&#x27;, &#x27;csv&#x27;. CSV: Page size limited to 10000 records
       */
      format?: string;
      /**
       * Token pair. Format: base_token_symbol/quote_token_symbol. Example: ZRX/WETH
       */
      pair?: string;
    }
    export interface IAggregatedOrdersService {

      get(params: IAggregatedOrdersGetParams, headers?: IAdditionalHeaders): Promise<IAggregatedOrderData>;
    }

    export class AggregatedOrdersService extends ApiService implements IAggregatedOrdersService {

      public async get(params: IAggregatedOrdersGetParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/aggregated_orders`
        };

        requestParams.queryParameters = {
          baseSymbol: params.baseSymbol,
          quoteSymbol: params.quoteSymbol,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IAggregatedOrderData>(requestParams, headers);
      }
    }
    export interface IAssetPairsService {

      /**
       * Get a list of supported asset pairs
       */
      get(params: IAssetPairsGetParams, headers?: IAdditionalHeaders): Promise<IGetAssetPairsResponse>;
    }

    export class AssetPairsService extends ApiService implements IAssetPairsService {

      /**
       * Get a list of supported asset pairs
       */
      public async get(params: IAssetPairsGetParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/asset_pairs`
        };

        requestParams.queryParameters = {
          page: params.page,
          perPage: params.perPage,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IGetAssetPairsResponse>(requestParams, headers);
      }
    }
    export interface INetworksService {

      /**
       * Get supported network info
       */
      getSupportedNetwork(headers?: IAdditionalHeaders): Promise<INetwork>;

      /**
       * Determine if app is in maintenance mode
       */
      isMaintenance(headers?: IAdditionalHeaders): Promise<IMaintenanceStatus>;

      /**
       * Get contract address for bulk token utility contract
       */
      getBulkTokenContract(headers?: IAdditionalHeaders): Promise<string>;
    }

    export class NetworksService extends ApiService implements INetworksService {

      /**
       * Get supported network info
       */
      public async getSupportedNetwork(headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/networks`
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<INetwork>(requestParams, headers);
      }

      /**
       * Determine if app is in maintenance mode
       */
      public async isMaintenance(headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/networks/maintenance`
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IMaintenanceStatus>(requestParams, headers);
      }

      /**
       * Get contract address for bulk token utility contract
       */
      public async getBulkTokenContract(headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/networks/bulk_token_contract`
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<string>(requestParams, headers);
      }
    }
    export interface INewsService {

      getCryptoPanic(params: INewsGetCryptoPanicParams, headers?: IAdditionalHeaders): Promise<ICryptoPanicPostsResponse>;

      getErcDex(params: INewsGetErcDexParams, headers?: IAdditionalHeaders): Promise<IGetNewsItemsResponse>;
    }

    export class NewsService extends ApiService implements INewsService {

      public async getCryptoPanic(params: INewsGetCryptoPanicParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/news/cryptopanic/${params.symbol}`
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<ICryptoPanicPostsResponse>(requestParams, headers);
      }

      public async getErcDex(params: INewsGetErcDexParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/news/ercdex`
        };

        requestParams.queryParameters = {
          page: params.page,
          perPage: params.perPage,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IGetNewsItemsResponse>(requestParams, headers);
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
          url: `${baseApiUrl}/api/v2/notifications`
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
       * Submit a signed order
       */
      createOrder(params: IOrdersCreateOrderParams, headers?: IAdditionalHeaders): Promise<Order>;

      /**
       * Get a single order by ID
       */
      getOrderById(params: IOrdersGetOrderByIdParams, headers?: IAdditionalHeaders): Promise<IOrderData>;

      /**
       * Get a list of orders
       */
      get(params: IOrdersGetParams, headers?: IAdditionalHeaders): Promise<IGetOrdersResponse>;

      /**
       * Get a single order by hash
       */
      getOrderByHash(params: IOrdersGetOrderByHashParams, headers?: IAdditionalHeaders): Promise<IOrderData>;

      getOrderConfig(params: IOrdersGetOrderConfigParams, headers?: IAdditionalHeaders): Promise<IOrderConfig>;

      getFeeRecipients(headers?: IAdditionalHeaders): Promise<IFeeRecipientsResponse>;

      getOrderbook(params: IOrdersGetOrderbookParams, headers?: IAdditionalHeaders): Promise<IOrderbookResponse>;

      /**
       * Cancel one or more orders
       */
      cancel(params: IOrdersCancelParams, headers?: IAdditionalHeaders): Promise<ICancelOrderResult[]>;
    }

    export class OrdersService extends ApiService implements IOrdersService {

      /**
       * Submit a signed order
       */
      public async createOrder(params: IOrdersCreateOrderParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'POST',
          url: `${baseApiUrl}/api/v2/order`
        };

        requestParams.body = params.request;
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<Order>(requestParams, headers);
      }

      /**
       * Get a single order by ID
       */
      public async getOrderById(params: IOrdersGetOrderByIdParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/order`
        };

        requestParams.queryParameters = {
          orderId: params.orderId,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IOrderData>(requestParams, headers);
      }

      /**
       * Get a list of orders
       */
      public async get(params: IOrdersGetParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/orders`
        };

        requestParams.queryParameters = {
          open: params.open,
          page: params.page,
          perPage: params.perPage,
          exchangeAddress: params.exchangeAddress,
          feeRecipientAddress: params.feeRecipientAddress,
          takerAssetData: params.takerAssetData,
          makerAssetData: params.makerAssetData,
          senderAddress: params.senderAddress,
          traderAssetData: params.traderAssetData,
          traderAddress: params.traderAddress,
          takerAssetAddress: params.takerAssetAddress,
          takerAddress: params.takerAddress,
          makerAssetAddress: params.makerAssetAddress,
          makerAddress: params.makerAddress,
          makerAssetProxyId: params.makerAssetProxyId,
          takerAssetProxyId: params.takerAssetProxyId,
          pair: params.pair,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IGetOrdersResponse>(requestParams, headers);
      }

      /**
       * Get a single order by hash
       */
      public async getOrderByHash(params: IOrdersGetOrderByHashParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/order/${params.orderHash}`
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IOrderData>(requestParams, headers);
      }

      public async getOrderConfig(params: IOrdersGetOrderConfigParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/order_config`
        };

        requestParams.queryParameters = {
          makerAddress: params.makerAddress,
          takerAddress: params.takerAddress,
          makerAssetAmount: params.makerAssetAmount,
          takerAssetAmount: params.takerAssetAmount,
          makerAssetData: params.makerAssetData,
          takerAssetData: params.takerAssetData,
          exchangeAddress: params.exchangeAddress,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IOrderConfig>(requestParams, headers);
      }

      public async getFeeRecipients(headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/fee_recipients`
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IFeeRecipientsResponse>(requestParams, headers);
      }

      public async getOrderbook(params: IOrdersGetOrderbookParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/orderbook`
        };

        requestParams.queryParameters = {
          baseAssetData: params.baseAssetData,
          quoteAssetData: params.quoteAssetData,
          perPage: params.perPage,
          page: params.page,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IOrderbookResponse>(requestParams, headers);
      }

      /**
       * Cancel one or more orders
       */
      public async cancel(params: IOrdersCancelParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'POST',
          url: `${baseApiUrl}/api/v2/orders/cancel`
        };

        requestParams.body = params.request;
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<ICancelOrderResult[]>(requestParams, headers);
      }
    }
    export interface IReportsService {

      getTickerData(headers?: IAdditionalHeaders): Promise<ITokenTicker[]>;
    }

    export class ReportsService extends ApiService implements IReportsService {

      public async getTickerData(headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/reports/ticker`
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<ITokenTicker[]>(requestParams, headers);
      }
    }
    export interface ITickerService {

      get(params: ITickerGetParams, headers?: IAdditionalHeaders): Promise<IGlobalTickerRecord[]>;
    }

    export class TickerService extends ApiService implements ITickerService {

      public async get(params: ITickerGetParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/ticker`
        };

        requestParams.queryParameters = {
          granularity: params.granularity,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IGlobalTickerRecord[]>(requestParams, headers);
      }
    }
    export interface ITokenRequestService {

      create(params: ITokenRequestCreateParams, headers?: IAdditionalHeaders): Promise<void>;
    }

    export class TokenRequestService extends ApiService implements ITokenRequestService {

      public async create(params: ITokenRequestCreateParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'POST',
          url: `${baseApiUrl}/api/v2/token_requests`
        };

        requestParams.body = params.request;
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<void>(requestParams, headers);
      }
    }
    export interface ITradeService {

      /**
       * Redeem a signed quote (see RequestFill to receive a quote)
       */
      fill(params: ITradeFillParams, headers?: IAdditionalHeaders): Promise<FillReceipt>;

      /**
       * Request to fill an order; returns a quote payload that can be signed and redeemed to begin execution
       */
      requestFill(params: ITradeRequestFillParams, headers?: IAdditionalHeaders): Promise<MarketQuote>;

      /**
       * Get a quote for a requested quantity
       */
      getMarketQuote(params: ITradeGetMarketQuoteParams, headers?: IAdditionalHeaders): Promise<IMarketOrderQuote>;

      /**
       * Get a quote by percentage
       */
      getMarketQuoteByPercent(params: ITradeGetMarketQuoteByPercentParams, headers?: IAdditionalHeaders): Promise<IMarketOrderQuote>;

      /**
       * Get a receipt of an attempted fill
       */
      getReceipt(params: ITradeGetReceiptParams, headers?: IAdditionalHeaders): Promise<FillReceipt>;

      getReceipts(params: ITradeGetReceiptsParams, headers?: IAdditionalHeaders): Promise<IGetReceiptsResponse>;
    }

    export class TradeService extends ApiService implements ITradeService {

      /**
       * Redeem a signed quote (see RequestFill to receive a quote)
       */
      public async fill(params: ITradeFillParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'POST',
          url: `${baseApiUrl}/api/v2/trade/fill`
        };

        requestParams.body = params.request;
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<FillReceipt>(requestParams, headers);
      }

      /**
       * Request to fill an order; returns a quote payload that can be signed and redeemed to begin execution
       */
      public async requestFill(params: ITradeRequestFillParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'POST',
          url: `${baseApiUrl}/api/v2/trade/request_fill`
        };

        requestParams.body = params.request;
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<MarketQuote>(requestParams, headers);
      }

      /**
       * Get a quote for a requested quantity
       */
      public async getMarketQuote(params: ITradeGetMarketQuoteParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'POST',
          url: `${baseApiUrl}/api/v2/trade/market_quote`
        };

        requestParams.body = params.request;
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IMarketOrderQuote>(requestParams, headers);
      }

      /**
       * Get a quote by percentage
       */
      public async getMarketQuoteByPercent(params: ITradeGetMarketQuoteByPercentParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'POST',
          url: `${baseApiUrl}/api/v2/trade/market_quote_by_percent`
        };

        requestParams.body = params.request;
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IMarketOrderQuote>(requestParams, headers);
      }

      /**
       * Get a receipt of an attempted fill
       */
      public async getReceipt(params: ITradeGetReceiptParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/trade/receipt/${params.id}`
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<FillReceipt>(requestParams, headers);
      }

      public async getReceipts(params: ITradeGetReceiptsParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/trade/receipts`
        };

        requestParams.queryParameters = {
          page: params.page,
          perPage: params.perPage,
          taker_address: params.taker_address,
          pair: params.pair,
          maker_address: params.maker_address,
          orderId: params.orderId,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IGetReceiptsResponse>(requestParams, headers);
      }
    }
    export interface ITradingViewService {

      getLogs(params: ITradingViewGetLogsParams, headers?: IAdditionalHeaders): Promise<ITradingViewLog[]>;
    }

    export class TradingViewService extends ApiService implements ITradingViewService {

      public async getLogs(params: ITradingViewGetLogsParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/trading_view`
        };

        requestParams.queryParameters = {
          pair: params.pair,
          resolution: params.resolution,
          startDate: params.startDate,
          endDate: params.endDate,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<ITradingViewLog[]>(requestParams, headers);
      }
    }
    export interface ITradeHistoryLogsService {

      get(params: ITradeHistoryLogsGetParams, headers?: IAdditionalHeaders): Promise<IGetTradeHistoryLogsResponse>;
    }

    export class TradeHistoryLogsService extends ApiService implements ITradeHistoryLogsService {

      public async get(params: ITradeHistoryLogsGetParams, headers?: IAdditionalHeaders) {
        const requestParams: IRequestParams = {
          method: 'GET',
          url: `${baseApiUrl}/api/v2/trade_history_logs`
        };

        requestParams.queryParameters = {
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
          pair: params.pair,
        };
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<IGetTradeHistoryLogsResponse>(requestParams, headers);
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
  baseSymbol: string;
  quoteSymbol: string;
  
}
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export interface IOrderChangeEventData {
  order: Order;
  eventType: "canceled" | "created" | "expired" | "filled" | "partially-filled" | "removed";
  
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
   * 0x Exchange Contract Address
   */
  exchangeAddress: string;
  /**
   * Unix timestamp of order expiration (in seconds)
   */
  expirationTimeSeconds: string;
  /**
   * Address of the fee recipient
   */
  feeRecipientAddress: string;
  /**
   * Address of the order maker
   */
  makerAddress: string;
  /**
   * Fee due from maker on order fill
   */
  makerFee: string;
  /**
   * Token address of the maker token
   */
  makerAssetAddress: string;
  /**
   * Encoded maker asset data
   */
  makerAssetData: string;
  /**
   * Encoded taker asset data
   */
  takerAssetData: string;
  /**
   * Total amount of maker token in order
   */
  makerAssetAmount: string;
  /**
   * Secure salt
   */
  salt: string;
  /**
   * Serialized version of the EC signature for signed orders
   */
  signature: string;
  /**
   * Taker address; generally a null taker
   */
  takerAddress: string;
  /**
   * Fee due from taker on order fill
   */
  takerFee: string;
  /**
   * Token address of the taker token
   */
  takerAssetAddress: string;
  /**
   * Total amount of taker token in order
   */
  takerAssetAmount: string;
  /**
   * Remaining amount that can be filled in taker tokens
   */
  remainingFillableTakerAmount: string;
  /**
   * Remaining amount that can be filled in maker tokens
   */
  remainingFillableMakerAmount: string;
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
   * Filled (2), Expired(3), Removed(4)
   */
  state: number;
  price: string;
  senderAddress: string;
  system: boolean;
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
  accountType?: "developer" | "market-maker" | "other" | "relayer" | "trader";
  phoneNumber?: string;
  referrerAccountId?: number;
  referralWalletId?: number;
  isConfirmed: boolean;
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
  symbol: string;
  usdPrice: string;
  dailyPercentageChange: string;
  dailyVolume: string;
  priceEth: string;
  
}
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export interface IAggregatedOrderFeedParams {
  baseSymbol: string;
  quoteSymbol: string;
  
}
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export interface IAggregatedOrderFeedData {
  baseSymbol: string;
  quoteSymbol: string;
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
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export interface IAccountReceiptChangeParams {
  account: string;
  
}
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export interface IFillReceiptChangeData {
  eventType: "create" | "error" | "success";
  receipt: FillReceipt;
  
}
export interface FillReceipt {
  txHash: string;
  taker: string;
  /**
   * Receipt status: success | error | pending
   */
  status: "error" | "pending" | "success";
  baseAssetAddress: string;
  baseSymbol: string;
  quoteSymbol: string;
  quoteAssetAddress: string;
  logs?: FillReceiptLog[];
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
export interface FillReceiptLog {
  orderId: number;
  receiptId: number;
  makerAddress: string;
  side: "buy" | "sell";
  takerAmount: string;
  makerAmount: string;
  price: string;
  isFeeOrder: boolean;
  receipt?: FillReceipt;
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

export interface IPairReceiptChangeParams {
  baseSymbol: string;
  quoteSymbol: string;
  
}
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export interface IQuotesEventParams {
  takerAddress: string;
  
}
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export interface IQuotesEventData {
  quote: MarketQuote;
  eventType: "expired" | "invalid";
  
}
export interface MarketQuote {
  /**
   * Unique salt
   */
  salt: string;
  /**
   * Pre-calculated hex to sign
   */
  hex: string;
  /**
   * Order taker
   */
  takerAddress: string;
  /**
   * Computed average price
   */
  price: string;
  /**
   * Total taker amount
   */
  takerAmount: string;
  /**
   * Total maker amount
   */
  makerAmount: string;
  /**
   * Address of taker token
   */
  takerAssetAddress: string;
  /**
   * Expiration - unix timestamp in seconds
   */
  expiration: number;
  /**
   * Symbol of the token used to pay fees
   */
  feeTokenSymbol: string;
  /**
   * Amount of fees paid in wei
   */
  feeAmount: string;
  /**
   * Amount of fees paid to cover network fees in wei
   */
  networkFeeAmount: string;
  /**
   * State of the quote (Open [0], Expired [1], Invalid [2], Redeemed [3])
   */
  state: number;
  /**
   * ID of order used to pay fees
   */
  feeOrderId?: number;
  /**
   * Order used to pay fees
   */
  feeOrder?: {
    /**
     * Enables basic storage and retrieval of dates and times.
     */
    dateClosed?: string;
    /**
     * 0x Exchange Contract Address
     */
    exchangeAddress: string;
    /**
     * Unix timestamp of order expiration (in seconds)
     */
    expirationTimeSeconds: string;
    /**
     * Address of the fee recipient
     */
    feeRecipientAddress: string;
    /**
     * Address of the order maker
     */
    makerAddress: string;
    /**
     * Fee due from maker on order fill
     */
    makerFee: string;
    /**
     * Token address of the maker token
     */
    makerAssetAddress: string;
    /**
     * Encoded maker asset data
     */
    makerAssetData: string;
    /**
     * Encoded taker asset data
     */
    takerAssetData: string;
    /**
     * Total amount of maker token in order
     */
    makerAssetAmount: string;
    /**
     * Secure salt
     */
    salt: string;
    /**
     * Serialized version of the EC signature for signed orders
     */
    signature: string;
    /**
     * Taker address; generally a null taker
     */
    takerAddress: string;
    /**
     * Fee due from taker on order fill
     */
    takerFee: string;
    /**
     * Token address of the taker token
     */
    takerAssetAddress: string;
    /**
     * Total amount of taker token in order
     */
    takerAssetAmount: string;
    /**
     * Remaining amount that can be filled in taker tokens
     */
    remainingFillableTakerAmount: string;
    /**
     * Remaining amount that can be filled in maker tokens
     */
    remainingFillableMakerAmount: string;
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
     * Filled (2), Expired(3), Removed(4)
     */
    state: number;
    price: string;
    senderAddress: string;
    system: boolean;
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
    
  };
  /**
   * Collection of fills
   */
  fills: MarketQuoteFill[];
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
  accountType?: "developer" | "market-maker" | "other" | "relayer" | "trader";
  phoneNumber?: string;
  referrerAccountId?: number;
  referralWalletId?: number;
  isConfirmed: boolean;
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
export interface MarketQuoteFill {
  /**
   * Computed hash verifying the authenticity of the order
   */
  orderId: number;
  /**
   * Computed hash verifying the authenticity of the order
   */
  quoteId: number;
  /**
   * Computed hash verifying the authenticity of the order
   */
  orderHash: string;
  /**
   * Taker amount in base units to fill from this order
   */
  takerAmount: string;
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

        return channel.toLowerCase();
      }
    }
    export interface IPairOrderChange extends ISocketEvent<IPairOrderChangeEventParams, IOrderChangeEventData> {};

    /**
     * Order changes relating to a token pair
     */
    export class PairOrderChange extends SocketEvent<IPairOrderChangeEventParams, IOrderChangeEventData> implements IPairOrderChange {
      protected path = 'pair-order-change/:baseSymbol/:quoteSymbol';
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
      protected path = 'aggregated-order-feed/:baseSymbol/:quoteSymbol';
    }
    export interface IMakerFillReceiptChange extends ISocketEvent<IAccountReceiptChangeParams, IFillReceiptChangeData> {};

    /**
     * State changes to FillReceipts associated with orders created by maker
     */
    export class MakerFillReceiptChange extends SocketEvent<IAccountReceiptChangeParams, IFillReceiptChangeData> implements IMakerFillReceiptChange {
      protected path = 'maker-fill-receipt-change/:account';
    }
    export interface ITakerFillReceiptChange extends ISocketEvent<IAccountReceiptChangeParams, IFillReceiptChangeData> {};

    /**
     * State changes to FillReceipts filled by taker
     */
    export class TakerFillReceiptChange extends SocketEvent<IAccountReceiptChangeParams, IFillReceiptChangeData> implements ITakerFillReceiptChange {
      protected path = 'taker-fill-receipt-change/:account';
    }
    export interface IPairFillReceiptChange extends ISocketEvent<IPairReceiptChangeParams, IFillReceiptChangeData> {};

    /**
     * State changes to FillReceipts belong to a certain asset pair
     */
    export class PairFillReceiptChange extends SocketEvent<IPairReceiptChangeParams, IFillReceiptChangeData> implements IPairFillReceiptChange {
      protected path = 'pair-fill-receipt-change/:baseSymbol/:quoteSymbol';
    }
    export interface IQuotes extends ISocketEvent<IQuotesEventParams, IQuotesEventData> {};

    /**
     * Changes to issued quotes
     */
    export class Quotes extends SocketEvent<IQuotesEventParams, IQuotesEventData> implements IQuotes {
      protected path = 'quotes/:takerAddress';
    }
  }
}
