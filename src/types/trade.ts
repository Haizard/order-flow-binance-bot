
import type { OrderStatus } from './binance';

export interface Trade {
  id: string;
  userId: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  entryPrice: number;
  quantity: number;
  entryTimestamp: number;
  tradeDirection: 'LONG' | 'SHORT';
  status:
    | 'ACTIVE_LONG_ENTRY'
    | 'ACTIVE_TRAILING_LONG'
    | 'ACTIVE_SHORT_ENTRY'
    | 'ACTIVE_TRAILING_SHORT'
    | 'CLOSED_EXITED'
    | 'CLOSED_ERROR';
  entryReason?: string;
  exitReason?: string;
  exitPrice?: number;
  exitTimestamp?: number;
  pnl?: number;
  pnlPercentage?: number;
  initialStopLossPrice?: number;
  trailingHighPrice?: number;
  trailingLowPrice?: number;
  sellError?: string;
  aiSummary?: string;
  // Fields from the exchange
  exchangeOrderId?: number;
  exchangeStatus?: OrderStatus;
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
