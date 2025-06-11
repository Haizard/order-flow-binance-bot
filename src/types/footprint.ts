
/**
 * @fileOverview Types related to footprint chart data aggregation.
 */

export interface FootprintTrade {
  id: number;         // Trade ID (t from Binance)
  time: number;       // Trade time (T from Binance)
  price: number;
  volume: number;
  side: 'buy' | 'sell'; // Determined by 'm' (is a maker)
}

export interface PriceLevelData {
  buyVolume: number;
  sellVolume: number;
}

export interface FootprintBar {
  symbol: string;
  timestamp: number;      // Start time of the bar/candle (e.g., start of the minute)
  open: number;
  high: number;
  low: number;
  close: number;
  totalVolume: number;
  delta: number;          // Total buy volume - total sell volume for the bar
  bidVolume: number;      // Total volume executed against bids (takers selling)
  askVolume: number;      // Total volume executed against asks (takers buying)
  priceLevels: Map<string, PriceLevelData>; // Key is price as string, e.g., "25000.50"
  tradesInBar: FootprintTrade[]; // Optional: store raw trades for more detailed analysis or debugging
}

// Type for incoming WebSocket trade data from Binance
export interface BinanceTradeData {
  e: "trade";      // Event type
  E: number;       // Event time
  s: string;       // Symbol
  t: number;       // Trade ID
  p: string;       // Price
  q: string;       // Quantity
  b: number;       // Buyer order ID
  a: number;       // Seller order ID
  T: number;       // Trade time
  m: boolean;      // Is the buyer the market maker? (true if buyer is maker, so it's a sell by taker)
  M: boolean;      // Ignore
}

export interface BinanceStreamData {
  stream: string; // e.g., "btcusdt@trade"
  data: BinanceTradeData;
}
