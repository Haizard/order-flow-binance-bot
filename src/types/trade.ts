
export interface Trade {
  id: string;
  userId: string; // Added for multi-user support
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  buyPrice: number;
  quantity: number;
  buyTimestamp: number;
  status: 'ACTIVE_BOUGHT' | 'ACTIVE_TRAILING' | 'CLOSED_SOLD' | 'CLOSED_ERROR';
  sellPrice?: number;
  sellTimestamp?: number;
  pnl?: number;
  pnlPercentage?: number;
  initialStopLossPrice?: number; // Added for initial stop-loss
  // For trailing stop: the highest price reached since trailing was activated
  trailingHighPrice?: number; 
  // For logging any errors during automated sell attempts
  sellError?: string; 
}

// Input type for creating a new trade
export type NewTradeInput = Pick<Trade, 'userId' | 'symbol' | 'baseAsset' | 'quoteAsset' | 'buyPrice' | 'quantity' | 'initialStopLossPrice'>;

// Input type for updating a trade to a sold status
export type SellTradeInput = Pick<Trade, 'sellPrice' | 'pnl' | 'pnlPercentage'>;

