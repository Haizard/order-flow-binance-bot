
'use server';
/**
 * @fileOverview Core bot logic for making trading decisions using a global strategy.
 */
import type { SettingsFormValues } from '@/components/settings/settings-form';
import { getSettings } from '@/services/settingsService';
import type { Ticker24hr } from '@/types/binance';
import type { Trade } from '@/types/trade';
import * as tradeService from '@/services/tradeService';
import { get24hrTicker } from '@/services/binance';
import {
    GLOBAL_DIP_PERCENTAGE,
    GLOBAL_BUY_AMOUNT_USD,
    GLOBAL_TRAIL_ACTIVATION_PROFIT,
    GLOBAL_TRAIL_DELTA,
    MONITORED_MARKET_SYMBOLS // Import the new symbols list
} from '@/config/bot-strategy';

// Placeholder for current user ID - replace with actual auth system integration if not passed in
const DEMO_USER_ID_BOT_FALLBACK = "bot_fallback_user";

// Helper function to extract base and quote assets from symbol
function getAssetsFromSymbol(symbol: string): { baseAsset: string, quoteAsset: string } {
    const commonQuoteAssets = ['USDT', 'BUSD', 'TUSD', 'FDUSD'];
    for (const quote of commonQuoteAssets) {
        if (symbol.endsWith(quote)) {
            return { baseAsset: symbol.slice(0, -quote.length), quoteAsset: quote };
        }
    }
    if (symbol.length > 3) {
        const potentialBase = symbol.substring(0, symbol.length - 3);
        const potentialQuote = symbol.substring(symbol.length - 3);
        if (potentialQuote.length === 3) return {baseAsset: potentialBase, quoteAsset: potentialQuote};

        const potentialBase2 = symbol.substring(0, symbol.length - 4);
        const potentialQuote2 = symbol.substring(symbol.length - 4);
         if (potentialQuote2.length === 4) return {baseAsset: potentialBase2, quoteAsset: potentialQuote2};
    }
    return { baseAsset: symbol.length > 3 ? symbol.slice(0, 3) : symbol, quoteAsset: symbol.length > 3 ? symbol.slice(3) : 'UNKNOWN' };
}

interface UserApiKeys {
  binanceApiKey?: string;
  binanceSecretKey?: string;
}

export async function runBotCycle(
  userIdInput: string,
  userApiSettings?: UserApiKeys, // Only API keys are needed from user settings now
  marketData?: Ticker24hr[]
): Promise<void> {
  const botRunTimestamp = new Date().toISOString();
  const userId = userIdInput || DEMO_USER_ID_BOT_FALLBACK;

  let apiKeys: UserApiKeys;

  if (userApiSettings && userApiSettings.binanceApiKey && userApiSettings.binanceSecretKey) {
    apiKeys = userApiSettings;
    console.log(`[${botRunTimestamp}] Bot cycle using PASSED-IN API keys for user ${userId}.`);
  } else {
    try {
      const fullUserSettings = await getSettings(userId); // Fetches user's API keys
      apiKeys = {
        binanceApiKey: fullUserSettings.binanceApiKey,
        binanceSecretKey: fullUserSettings.binanceSecretKey,
      };
      if (apiKeys.binanceApiKey && apiKeys.binanceSecretKey) {
        console.log(`[${botRunTimestamp}] Bot cycle using FETCHED API keys from database for user ${userId}.`);
      } else {
        console.warn(`[${botRunTimestamp}] Bot: User ${userId} API keys not found in database or incomplete. Will skip trading actions.`);
        apiKeys = {}; // Ensure apiKeys is an empty object if keys are missing/incomplete
      }
    } catch (error) {
      console.error(`[${botRunTimestamp}] Bot: CRITICAL - Failed to load API key settings from database for user ${userId}. Error:`, error instanceof Error ? error.message : String(error));
      apiKeys = {}; // No API keys, bot won't trade for this user
    }
  }

  // Centralized logging of global strategy parameters being used for this cycle
  console.log(`[${botRunTimestamp}] Bot cycle STARTED for user ${userId}. Global Strategy: Dip: ${GLOBAL_DIP_PERCENTAGE}%, Buy Amount: ${GLOBAL_BUY_AMOUNT_USD}, Trail Profit: ${GLOBAL_TRAIL_ACTIVATION_PROFIT}%, Trail Delta: ${GLOBAL_TRAIL_DELTA}%`);

  if (!apiKeys.binanceApiKey || !apiKeys.binanceSecretKey) {
    console.warn(`[${botRunTimestamp}] Bot: User ${userId} is missing API keys or they were not loaded. Skipping trading actions for this user.`);
    return;
  }

  // Fetch market data if not provided
  let liveMarketData: Ticker24hr[];
  if (marketData) {
    liveMarketData = marketData;
  } else {
    // const marketSymbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "XRPUSDT", "SOLUSDT"]; // This line is removed
    try {
      const tickerPromises = MONITORED_MARKET_SYMBOLS.map(symbol => get24hrTicker(symbol) as Promise<Ticker24hr | null>); // Admin/System API key could be used here
      const results = await Promise.all(tickerPromises);
      liveMarketData = results.filter(item => item !== null && !Array.isArray(item)) as Ticker24hr[];
    } catch (error) {
      console.error(`[${botRunTimestamp}] Bot: Failed to fetch live market data for independent cycle (user ${userId}):`, error);
      return; // Cannot proceed without market data
    }
  }


  const activeTrades = await tradeService.getActiveTrades(userId);
  const activeTradeSymbols = activeTrades.map(t => t.symbol);

  console.log(`[${botRunTimestamp}] Bot (User ${userId}): Checking for potential buys using GLOBAL_DIP_PERCENTAGE: ${GLOBAL_DIP_PERCENTAGE}%...`);
  for (const ticker of liveMarketData) {
    const priceChangePercent = parseFloat(ticker.priceChangePercent);
    if (priceChangePercent <= GLOBAL_DIP_PERCENTAGE) {
      if (!activeTradeSymbols.includes(ticker.symbol)) {
        console.log(`[${botRunTimestamp}] Bot (User ${userId}): Potential DIP BUY for ${ticker.symbol} at ${ticker.lastPrice} (24hr change: ${priceChangePercent}%). Global buy amount: $${GLOBAL_BUY_AMOUNT_USD}`);

        const currentPrice = parseFloat(ticker.lastPrice);
        if (currentPrice <= 0) {
            console.warn(`[${botRunTimestamp}] Bot (User ${userId}): Invalid current price (<=0) for ${ticker.symbol}, skipping buy.`);
            continue;
        }
        const quantityToBuy = GLOBAL_BUY_AMOUNT_USD / currentPrice;
        const { baseAsset, quoteAsset } = getAssetsFromSymbol(ticker.symbol);

        try {
          // IMPORTANT: Actual buy order placement would use the USER'S API keys (apiKeys.binanceApiKey, apiKeys.binanceSecretKey).
          // This needs to be integrated into an actual Binance order placement function.
          // For simulation, we just create a trade record.
          await tradeService.createTrade({
            userId: userId,
            symbol: ticker.symbol,
            baseAsset,
            quoteAsset,
            buyPrice: currentPrice,
            quantity: quantityToBuy,
          });
          console.log(`[${botRunTimestamp}] Bot (User ${userId}): SIMULATED BUY of ${quantityToBuy.toFixed(6)} ${baseAsset} (${ticker.symbol}) at $${currentPrice.toFixed(2)} for $${GLOBAL_BUY_AMOUNT_USD}. (Using user's API keys)`);
        } catch (error) {
          console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error creating trade for ${ticker.symbol}:`, error);
        }
      }
    }
  }

  console.log(`[${botRunTimestamp}] Bot (User ${userId}): Managing ${activeTrades.length} active trades...`);
  for (const trade of activeTrades) {
    let currentTickerData: Ticker24hr | null = null;
    try {
      // Price checks typically don't need user API keys if public ticker endpoint is used (admin key could be used here)
      const tickerResult = await get24hrTicker(trade.symbol);
      currentTickerData = Array.isArray(tickerResult) ? tickerResult.find(t => t.symbol === trade.symbol) || null : tickerResult;

      if (!currentTickerData) {
        console.warn(`[${botRunTimestamp}] Bot (User ${userId}): Could not fetch current price for active trade ${trade.symbol}. Skipping management.`);
        continue;
      }
    } catch (error) {
      console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error fetching ticker for active trade ${trade.symbol}:`, error);
      continue;
    }

    const currentPrice = parseFloat(currentTickerData.lastPrice);
    const profitPercentage = ((currentPrice - trade.buyPrice) / trade.buyPrice) * 100;

    if (trade.status === 'ACTIVE_BOUGHT') {
      if (profitPercentage >= GLOBAL_TRAIL_ACTIVATION_PROFIT) {
        try {
          await tradeService.updateTrade(userId, trade.id, {
            status: 'ACTIVE_TRAILING',
            trailingHighPrice: currentPrice,
          });
          console.log(`[${botRunTimestamp}] Bot (User ${userId}): Trade ${trade.symbol} (ID: ${trade.id}) profit ${profitPercentage.toFixed(2)}% >= ${GLOBAL_TRAIL_ACTIVATION_PROFIT}%. ACTIVATED TRAILING STOP at high price $${currentPrice.toFixed(2)}.`);
        } catch (error) {
          console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error updating trade ${trade.id} to TRAILING:`, error);
        }
      }
    } else if (trade.status === 'ACTIVE_TRAILING') {
      if (!trade.trailingHighPrice) {
        console.warn(`[${botRunTimestamp}] Bot (User ${userId}): Trade ${trade.symbol} (ID: ${trade.id}) is TRAILING but has no trailingHighPrice. Resetting with current price.`);
        try {
            await tradeService.updateTrade(userId, trade.id, { trailingHighPrice: currentPrice });
        } catch (error) {
            console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error updating trailingHighPrice for ${trade.id}:`, error);
        }
        continue;
      }

      let newHighPrice = trade.trailingHighPrice;
      if (currentPrice > trade.trailingHighPrice) {
        newHighPrice = currentPrice;
        try {
            await tradeService.updateTrade(userId, trade.id, { trailingHighPrice: newHighPrice });
            console.log(`[${botRunTimestamp}] Bot (User ${userId}): Trade ${trade.symbol} (ID: ${trade.id}) new high for trailing: $${newHighPrice.toFixed(2)}.`);
        } catch (error) {
            console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error updating new trailingHighPrice for ${trade.id}:`, error);
        }
      }

      const trailStopPrice = newHighPrice * (1 - GLOBAL_TRAIL_DELTA / 100);
      if (currentPrice <= trailStopPrice) {
        const sellPrice = currentPrice;
        const pnl = (sellPrice - trade.buyPrice) * trade.quantity;
        const pnlPercentageValue = (trade.buyPrice * trade.quantity === 0) ? 0 : (pnl / (trade.buyPrice * trade.quantity)) * 100;
        try {
          // IMPORTANT: Actual sell order placement would use USER'S API keys.
          await tradeService.updateTrade(userId, trade.id, {
            status: 'CLOSED_SOLD',
            sellPrice: sellPrice,
            sellTimestamp: Date.now(),
            pnl: pnl,
            pnlPercentage: pnlPercentageValue,
          });
          console.log(`[${botRunTimestamp}] Bot (User ${userId}): SIMULATED SELL (Trailing Stop) of ${trade.quantity.toFixed(6)} ${trade.baseAsset} (${trade.symbol}) ID: ${trade.id} at $${sellPrice.toFixed(2)}. P&L: $${pnl.toFixed(2)} (${pnlPercentageValue.toFixed(2)}%). Stop: $${trailStopPrice.toFixed(2)} (High: $${newHighPrice.toFixed(2)}) (Using user's API keys)`);
        } catch (error) {
          console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error closing trade ${trade.id} via trailing stop:`, error);
           try {
             await tradeService.updateTrade(userId, trade.id, { status: 'CLOSED_ERROR', sellError: error instanceof Error ? error.message : String(error) });
           } catch (dbError) {
             console.error(`[${botRunTimestamp}] Bot (User ${userId}): CRITICAL - Failed to mark trade ${trade.id} as error state after sell failure:`, dbError);
           }
        }
      }
    }
  }
  console.log(`[${botRunTimestamp}] Bot cycle ENDED for user ${userId}.`);
}
