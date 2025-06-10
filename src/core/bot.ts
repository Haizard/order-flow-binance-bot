
'use server';
/**
 * @fileOverview Core bot logic for making trading decisions.
 */
import type { SettingsFormValues } from '@/components/settings/settings-form';
import type { Ticker24hr } from '@/types/binance';
import type { Trade } from '@/types/trade';
import * as tradeService from '@/services/tradeService';
import { get24hrTicker } from '@/services/binance'; // To fetch current price for P&L

// Helper function to extract base and quote assets from symbol
function getAssetsFromSymbol(symbol: string): { baseAsset: string, quoteAsset: string } {
    // Basic implementation, assumes USDT, BUSD, TUSD, FDUSD as common quote assets
    const commonQuoteAssets = ['USDT', 'BUSD', 'TUSD', 'FDUSD'];
    for (const quote of commonQuoteAssets) {
        if (symbol.endsWith(quote)) {
            return { baseAsset: symbol.slice(0, -quote.length), quoteAsset: quote };
        }
    }
    // Fallback if no common quote asset is found (e.g. BTCETH)
    // This might need more sophisticated logic for non-standard pairs
    if (symbol.length > 3) { // Heuristic
        return { baseAsset: symbol.slice(0, 3), quoteAsset: symbol.slice(3) };
    }
    return { baseAsset: symbol, quoteAsset: 'UNKNOWN' }; // Should not happen with valid Binance symbols
}


export async function runBotCycle(settings: SettingsFormValues, marketData: Ticker24hr[]): Promise<void> {
  const botRunTimestamp = new Date().toISOString();
  console.log(`[${botRunTimestamp}] Bot cycle STARTED. Dip: ${settings.dipPercentage}%, Buy Amount: ${settings.buyAmountUsd}, Trail Profit: ${settings.trailActivationProfit}%, Trail Delta: ${settings.trailDelta}%`);

  if (!settings.isBotActive) {
    console.log(`[${botRunTimestamp}] Bot is INACTIVE. Skipping cycle.`);
    return;
  }

  const activeTrades = await tradeService.getActiveTrades();
  const activeTradeSymbols = activeTrades.map(t => t.symbol);

  // 1. Identify Potential Buys
  console.log(`[${botRunTimestamp}] Bot: Checking for potential buys...`);
  for (const ticker of marketData) {
    const priceChangePercent = parseFloat(ticker.priceChangePercent);
    if (priceChangePercent <= settings.dipPercentage) {
      if (!activeTradeSymbols.includes(ticker.symbol)) {
        // Not already holding this coin, consider buying
        console.log(`[${botRunTimestamp}] Bot: Potential DIP BUY for ${ticker.symbol} at ${ticker.lastPrice} (24hr change: ${priceChangePercent}%).`);
        
        const currentPrice = parseFloat(ticker.lastPrice);
        if (currentPrice <= 0) {
            console.warn(`[${botRunTimestamp}] Bot: Invalid current price (<=0) for ${ticker.symbol}, skipping buy.`);
            continue;
        }
        const quantityToBuy = settings.buyAmountUsd / currentPrice;
        const { baseAsset, quoteAsset } = getAssetsFromSymbol(ticker.symbol);

        try {
          await tradeService.createTrade({
            symbol: ticker.symbol,
            baseAsset,
            quoteAsset,
            buyPrice: currentPrice,
            quantity: quantityToBuy,
          });
          console.log(`[${botRunTimestamp}] Bot: SIMULATED BUY of ${quantityToBuy.toFixed(6)} ${baseAsset} (${ticker.symbol}) at $${currentPrice.toFixed(2)} for $${settings.buyAmountUsd}.`);
        } catch (error) {
          console.error(`[${botRunTimestamp}] Bot: Error creating trade for ${ticker.symbol}:`, error);
        }
      } else {
        // console.log(`[${botRunTimestamp}] Bot: Dip detected for ${ticker.symbol}, but already holding an active trade.`);
      }
    }
  }

  // 2. Manage Active Trades (Trailing Stop Loss / Selling)
  console.log(`[${botRunTimestamp}] Bot: Managing ${activeTrades.length} active trades...`);
  for (const trade of activeTrades) {
    let currentTickerData: Ticker24hr | null = null;
    try {
      const tickerResult = await get24hrTicker(trade.symbol); // Fetch fresh price
      if (Array.isArray(tickerResult)) { // Should be single for specific symbol
        currentTickerData = tickerResult.find(t => t.symbol === trade.symbol) || null;
      } else {
        currentTickerData = tickerResult;
      }

      if (!currentTickerData) {
        console.warn(`[${botRunTimestamp}] Bot: Could not fetch current price for active trade ${trade.symbol}. Skipping management for this cycle.`);
        continue;
      }
    } catch (error) {
      console.error(`[${botRunTimestamp}] Bot: Error fetching ticker for active trade ${trade.symbol}:`, error);
      continue;
    }
    
    const currentPrice = parseFloat(currentTickerData.lastPrice);
    const profitPercentage = ((currentPrice - trade.buyPrice) / trade.buyPrice) * 100;

    if (trade.status === 'ACTIVE_BOUGHT') {
      if (profitPercentage >= settings.trailActivationProfit) {
        // Activate trailing stop
        try {
          await tradeService.updateTrade(trade.id, {
            status: 'ACTIVE_TRAILING',
            trailingHighPrice: currentPrice, // Start trailing from current price
          });
          console.log(`[${botRunTimestamp}] Bot: Trade ${trade.symbol} (ID: ${trade.id}) profit ${profitPercentage.toFixed(2)}% >= ${settings.trailActivationProfit}%. ACTIVATED TRAILING STOP at high price $${currentPrice.toFixed(2)}.`);
        } catch (error) {
          console.error(`[${botRunTimestamp}] Bot: Error updating trade ${trade.id} to TRAILING:`, error);
        }
      }
    } else if (trade.status === 'ACTIVE_TRAILING') {
      if (!trade.trailingHighPrice) {
        console.warn(`[${botRunTimestamp}] Bot: Trade ${trade.symbol} (ID: ${trade.id}) is TRAILING but has no trailingHighPrice. Resetting to current price.`);
        try {
            await tradeService.updateTrade(trade.id, { trailingHighPrice: currentPrice });
        } catch (error) {
            console.error(`[${botRunTimestamp}] Bot: Error updating trailingHighPrice for ${trade.id}:`, error);
        }
        continue; // Re-evaluate next cycle
      }

      // Update high price if current price is higher
      let newHighPrice = trade.trailingHighPrice;
      if (currentPrice > trade.trailingHighPrice) {
        newHighPrice = currentPrice;
        try {
            await tradeService.updateTrade(trade.id, { trailingHighPrice: newHighPrice });
            console.log(`[${botRunTimestamp}] Bot: Trade ${trade.symbol} (ID: ${trade.id}) new high for trailing: $${newHighPrice.toFixed(2)}.`);
        } catch (error) {
            console.error(`[${botRunTimestamp}] Bot: Error updating new trailingHighPrice for ${trade.id}:`, error);
        }
      }

      const trailStopPrice = newHighPrice * (1 - settings.trailDelta / 100);
      if (currentPrice <= trailStopPrice) {
        // Sell - Trailing stop triggered
        const sellPrice = currentPrice; // Simulate selling at current market price
        const pnl = (sellPrice - trade.buyPrice) * trade.quantity;
        const pnlPercentage = ((sellPrice - trade.buyPrice) / trade.buyPrice) * 100;
        try {
          await tradeService.updateTrade(trade.id, {
            status: 'CLOSED_SOLD',
            sellPrice: sellPrice,
            sellTimestamp: Date.now(),
            pnl: pnl,
            pnlPercentage: pnlPercentage,
          });
          console.log(`[${botRunTimestamp}] Bot: SIMULATED SELL (Trailing Stop) of ${trade.quantity.toFixed(6)} ${trade.baseAsset} (${trade.symbol}) ID: ${trade.id} at $${sellPrice.toFixed(2)}. P&L: $${pnl.toFixed(2)} (${pnlPercentage.toFixed(2)}%). Stop triggered at $${trailStopPrice.toFixed(2)} (High: $${newHighPrice.toFixed(2)})`);
        } catch (error) {
          console.error(`[${botRunTimestamp}] Bot: Error closing trade ${trade.id} via trailing stop:`, error);
           try {
             await tradeService.updateTrade(trade.id, { status: 'CLOSED_ERROR', sellError: error instanceof Error ? error.message : String(error) });
           } catch (dbError) {
             console.error(`[${botRunTimestamp}] Bot: CRITICAL - Failed to mark trade ${trade.id} as error state after sell failure:`, dbError);
           }
        }
      }
    }
  }
  console.log(`[${botRunTimestamp}] Bot cycle ENDED.`);
}
