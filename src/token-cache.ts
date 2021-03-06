import { ErcDex } from './generated/ercdex';

export class TokenCache {
  private tokenPairsPromise: Promise<ErcDex.Api.ITokenPair[]> | undefined;
  private tokenSymbolMap: Record<string, ErcDex.Api.IToken> | undefined;

  public async getTokenPair(baseSymbol: string, quoteSymbol: string) {
    const tokenPairs = await this.getSupportedTokenPairs();

    const tokenPair = tokenPairs.find(tp => tp.assetDataA.symbol.toLowerCase() === baseSymbol.toLowerCase()
      && tp.assetDataB.symbol.toLowerCase() === quoteSymbol.toLowerCase());
    if (!tokenPair) {
      throw new Error(`token pair not found or supported: ${baseSymbol}/${quoteSymbol}`);
    }

    return tokenPair;
  }

  public async getTokenBySymbol(symbol: string) {
    const map = await this.getTokenMap();

    const token = map[symbol];
    if (!token) {
      throw new Error(`token not found or supported: ${symbol}`);
    }

    return token;
  }

  private async getSupportedTokenPairs() {
    if (this.tokenPairsPromise) {
      return await this.tokenPairsPromise;
    }

    return this.tokenPairsPromise = (async () => {
      const result = await new ErcDex.Api.AssetPairsService().get({ perPage: 200, page: 1 });
      return result.records;
    })();
  }

  private async getTokenMap() {
    if (this.tokenSymbolMap) { return this.tokenSymbolMap; }

    const tokenPairs = await this.getSupportedTokenPairs();

    const map: Record<string, ErcDex.Api.IToken> = {};
    tokenPairs.forEach(tp => {
      map[tp.assetDataA.symbol] = tp.assetDataA;
      map[tp.assetDataB.symbol] = tp.assetDataB;
    });

    this.tokenSymbolMap = map;
    return map;
  }
}

export const tokenCache = new TokenCache();
