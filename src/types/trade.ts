
export interface Trade {
  id: string;
  userId: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  entryPrice: number;         // Renamed from buyPrice
  quantity: number;
  entryTimestamp: number;     // Renamed from buyTimestamp
  tradeDirection: 'LONG' | 'SHORT'; // Added to specify trade direction
  status:
    | 'ACTIVE_LONG_ENTRY'
    | 'ACTIVE_TRAILING_LONG'
    | 'ACTIVE_SHORT_ENTRY'
    | 'ACTIVE_TRAILING_SHORT'
    | 'CLOSED_EXITED'         // Generalized from CLOSED_SOLD
    | 'CLOSED_ERROR';
  entryReason?: string;        // Why the bot entered the trade
  exitReason?: string;         // Why the bot exited the trade
  exitPrice?: number;          // Renamed from sellPrice
  exitTimestamp?: number;      // Renamed from sellTimestamp
  pnl?: number;
  pnlPercentage?: number;
  initialStopLossPrice?: number;
  trailingHighPrice?: number;  // For trailing stop of LONG trades (highest price reached)
  trailingLowPrice?: number;   // For trailing stop of SHORT trades (lowest price reached)
  sellError?: string;          // Kept for logging specific sell/exit errors
  aiSummary?: string;          // The AI-generated summary of the trade
}

// Input type for creating a new trade
export type NewTradeInput = Pick<
  Trade,
  | 'userId'
  | 'symbol'
  | 'baseAsset'
  | 'quoteAsset'
  | 'entryPrice'
  | 'quantity'
  | 'initialStopLossPrice'
  | 'tradeDirection'
  | 'entryReason'
  // entryTimestamp will be set by the service
>;

// Input type for updating a trade to an exited status
export type ExitTradeInput = Pick<Trade, 'exitPrice' | 'pnl' | 'pnlPercentage'>;
