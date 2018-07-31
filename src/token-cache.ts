import { Aqueduct } from './generated/aqueduct';

export class TokenCache {
  private tokenPairsPromise: Promise<Aqueduct.Api.ITokenPair[]> | undefined;
  private tokenSymbolMap: Record<string, Aqueduct.Api.IToken> | undefined;

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

    const promise = this.tokenPairsPromise = (async () => {
      const result = await new Aqueduct.Api.AssetPairsService().get({});
      return result.records;
    })();
    return await promise;
  }

  private async getTokenMap() {
    if (this.tokenSymbolMap) { return this.tokenSymbolMap; }

    const tokenPairs = await this.getSupportedTokenPairs();

    const map: Record<string, Aqueduct.Api.IToken> = {};
    tokenPairs.forEach(tp => {
      map[tp.assetDataA.symbol] = tp.assetDataA;
      map[tp.assetDataB.symbol] = tp.assetDataB;
    });

    this.tokenSymbolMap = map;
    return map;
  }
}

export const tokenCache = new TokenCache();
