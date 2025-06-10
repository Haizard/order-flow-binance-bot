
'use server';
/**
 * @fileOverview Core bot logic for making trading decisions.
 */
import type { SettingsFormValues } from '@/components/settings/settings-form';
import { getSettings } from '@/services/settingsService'; // Import getSettings
import type { Ticker24hr } from '@/types/binance';
import type { Trade } from '@/types/trade';
import * as tradeService from '@/services/tradeService';
import { get24hrTicker } from '@/services/binance';

// Helper function to extract base and quote assets from symbol
function getAssetsFromSymbol(symbol: string): { baseAsset: string, quoteAsset: string } {
    const commonQuoteAssets = ['USDT', 'BUSD', 'TUSD', 'FDUSD'];
    for (const quote of commonQuoteAssets) {
        if (symbol.endsWith(quote)) {
            return { baseAsset: symbol.slice(0, -quote.length), quoteAsset: quote };
        }
    }
    if (symbol.length > 3) {
        return { baseAsset: symbol.slice(0, 3), quoteAsset: symbol.slice(3) };
    }
    return { baseAsset: symbol, quoteAsset: 'UNKNOWN' };
}


export async function runBotCycle(currentSettings?: SettingsFormValues, marketData?: Ticker24hr[]): Promise<void> {
  const botRunTimestamp = new Date().toISOString();
  
  let settings: SettingsFormValues;
  if (currentSettings) {
    settings = currentSettings;
    console.log(`[${botRunTimestamp}] Bot cycle using PASSED-IN settings.`);
  } else {
    try {
      settings = await getSettings();
      console.log(`[${botRunTimestamp}] Bot cycle using FETCHED settings from database.`);
    } catch (error) {
      console.error(`[${botRunTimestamp}] Bot: CRITICAL - Failed to load settings from database. Error:`, error instanceof Error ? error.message : String(error), "Using fallback defaults for safety.");
      // Fallback to a safe default if settings can't be loaded to prevent undefined behavior.
      // This should ideally be defaultValues exported from settings-form.tsx,
      // but to avoid circular dependency or direct import here, we define a minimal safe default.
      settings = {
        binanceApiKey: "",
        binanceSecretKey: "",
        buyAmountUsd: 10, // Minimal buy amount
        dipPercentage: -5,
        trailActivationProfit: 2,
        trailDelta: 1,
        isBotActive: false, // Default to inactive if settings load fails
      };
    }
  }

  let liveMarketData: Ticker24hr[];
  if (marketData) {
    liveMarketData = marketData;
  } else {
    // Fetch market data if not provided (e.g. when run directly)
    // This is a simplified list; consider making it configurable or part of settings.
    const marketSymbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "XRPUSDT", "SOLUSDT"];
    try {
      const tickerPromises = marketSymbols.map(symbol => get24hrTicker(symbol) as Promise<Ticker24hr | null>);
      const results = await Promise.all(tickerPromises);
      liveMarketData = results.filter(item => item !== null) as Ticker24hr[];
    } catch (error) {
      console.error(`[${botRunTimestamp}] Bot: Failed to fetch live market data for independent cycle:`, error);
      return; // Cannot proceed without market data
    }
  }


  console.log(`[${botRunTimestamp}] Bot cycle STARTED. Settings: Dip: ${settings.dipPercentage}%, Buy Amount: ${settings.buyAmountUsd}, Trail Profit: ${settings.trailActivationProfit}%, Trail Delta: ${settings.trailDelta}%, Active: ${settings.isBotActive}`);

  if (!settings.isBotActive) {
    console.log(`[${botRunTimestamp}] Bot is INACTIVE according to settings. Skipping cycle.`);
    return;
  }

  const activeTrades = await tradeService.getActiveTrades();
  const activeTradeSymbols = activeTrades.map(t => t.symbol);

  // 1. Identify Potential Buys
  console.log(`[${botRunTimestamp}] Bot: Checking for potential buys...`);
  for (const ticker of liveMarketData) {
    const priceChangePercent = parseFloat(ticker.priceChangePercent);
    if (priceChangePercent <= settings.dipPercentage) {
      if (!activeTradeSymbols.includes(ticker.symbol)) {
        console.log(`[${botRunTimestamp}] Bot: Potential DIP BUY for ${ticker.symbol} at ${ticker.lastPrice} (24hr change: ${priceChangePercent}%).`);
        
        const currentPrice = parseFloat(ticker.lastPrice);
        if (currentPrice <= 0) {
            console.warn(`[${botRunTimestamp}] Bot: Invalid current price (<=0) for ${ticker.symbol}, skipping buy.`);
            continue;
        }
        // Ensure buyAmountUsd is defined and positive
        const buyAmount = settings.buyAmountUsd ?? 10; // Fallback to 10 if undefined, though Zod schema should prevent this
        const quantityToBuy = buyAmount / currentPrice;
        const { baseAsset, quoteAsset } = getAssetsFromSymbol(ticker.symbol);

        try {
          await tradeService.createTrade({
            symbol: ticker.symbol,
            baseAsset,
            quoteAsset,
            buyPrice: currentPrice,
            quantity: quantityToBuy,
          });
          console.log(`[${botRunTimestamp}] Bot: SIMULATED BUY of ${quantityToBuy.toFixed(6)} ${baseAsset} (${ticker.symbol}) at $${currentPrice.toFixed(2)} for $${buyAmount}.`);
        } catch (error) {
          console.error(`[${botRunTimestamp}] Bot: Error creating trade for ${ticker.symbol}:`, error);
        }
      }
    }
  }

  // 2. Manage Active Trades
  console.log(`[${botRunTimestamp}] Bot: Managing ${activeTrades.length} active trades...`);
  for (const trade of activeTrades) {
    let currentTickerData: Ticker24hr | null = null;
    try {
      const tickerResult = await get24hrTicker(trade.symbol);
      currentTickerData = Array.isArray(tickerResult) ? tickerResult.find(t => t.symbol === trade.symbol) || null : tickerResult;

      if (!currentTickerData) {
        console.warn(`[${botRunTimestamp}] Bot: Could not fetch current price for active trade ${trade.symbol}. Skipping management.`);
        continue;
      }
    } catch (error) {
      console.error(`[${botRunTimestamp}] Bot: Error fetching ticker for active trade ${trade.symbol}:`, error);
      continue;
    }
    
    const currentPrice = parseFloat(currentTickerData.lastPrice);
    const profitPercentage = ((currentPrice - trade.buyPrice) / trade.buyPrice) * 100;
    const trailActivation = settings.trailActivationProfit ?? 2; // Default if undefined
    const trailDeltaVal = settings.trailDelta ?? 1; // Default if undefined

    if (trade.status === 'ACTIVE_BOUGHT') {
      if (profitPercentage >= trailActivation) {
        try {
          await tradeService.updateTrade(trade.id, {
            status: 'ACTIVE_TRAILING',
            trailingHighPrice: currentPrice,
          });
          console.log(`[${botRunTimestamp}] Bot: Trade ${trade.symbol} (ID: ${trade.id}) profit ${profitPercentage.toFixed(2)}% >= ${trailActivation}%. ACTIVATED TRAILING STOP at high price $${currentPrice.toFixed(2)}.`);
        } catch (error) {
          console.error(`[${botRunTimestamp}] Bot: Error updating trade ${trade.id} to TRAILING:`, error);
        }
      }
    } else if (trade.status === 'ACTIVE_TRAILING') {
      if (!trade.trailingHighPrice) {
        console.warn(`[${botRunTimestamp}] Bot: Trade ${trade.symbol} (ID: ${trade.id}) is TRAILING but has no trailingHighPrice. Resetting.`);
        try {
            await tradeService.updateTrade(trade.id, { trailingHighPrice: currentPrice });
        } catch (error) {
            console.error(`[${botRunTimestamp}] Bot: Error updating trailingHighPrice for ${trade.id}:`, error);
        }
        continue;
      }

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

      const trailStopPrice = newHighPrice * (1 - trailDeltaVal / 100);
      if (currentPrice <= trailStopPrice) {
        const sellPrice = currentPrice;
        const pnl = (sellPrice - trade.buyPrice) * trade.quantity;
        const pnlPercentageValue = (trade.buyPrice * trade.quantity === 0) ? 0 : (pnl / (trade.buyPrice * trade.quantity)) * 100;
        try {
          await tradeService.updateTrade(trade.id, {
            status: 'CLOSED_SOLD',
            sellPrice: sellPrice,
            sellTimestamp: Date.now(),
            pnl: pnl,
            pnlPercentage: pnlPercentageValue,
          });
          console.log(`[${botRunTimestamp}] Bot: SIMULATED SELL (Trailing Stop) of ${trade.quantity.toFixed(6)} ${trade.baseAsset} (${trade.symbol}) ID: ${trade.id} at $${sellPrice.toFixed(2)}. P&L: $${pnl.toFixed(2)} (${pnlPercentageValue.toFixed(2)}%). Stop: $${trailStopPrice.toFixed(2)} (High: $${newHighPrice.toFixed(2)})`);
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
