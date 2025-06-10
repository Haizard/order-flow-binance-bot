
'use server';
/**
 * @fileOverview Core bot logic for making trading decisions.
 */
import type { SettingsFormValues } from '@/components/settings/settings-form';
import { getSettings } from '@/services/settingsService';
import { defaultSettingsValues } from "@/config/settings-defaults"; // Import new defaults
import type { Ticker24hr } from '@/types/binance';
import type { Trade } from '@/types/trade';
import * as tradeService from '@/services/tradeService';
import { get24hrTicker } from '@/services/binance';

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
    if (symbol.length > 3) { // Basic fallback for symbols like BTCETH
        const potentialBase = symbol.substring(0, symbol.length - 3);
        const potentialQuote = symbol.substring(symbol.length - 3);
        if (potentialQuote.length === 3) return {baseAsset: potentialBase, quoteAsset: potentialQuote};

        const potentialBase2 = symbol.substring(0, symbol.length - 4);
        const potentialQuote2 = symbol.substring(symbol.length - 4);
         if (potentialQuote2.length === 4) return {baseAsset: potentialBase2, quoteAsset: potentialQuote2};
    }
    // Absolute fallback if no common quote asset is found
    // This might not be ideal for all pairs but provides a default
    return { baseAsset: symbol.length > 3 ? symbol.slice(0, 3) : symbol, quoteAsset: symbol.length > 3 ? symbol.slice(3) : 'UNKNOWN' };
}


export async function runBotCycle(
  userIdInput: string,
  currentSettings?: SettingsFormValues, // Can be passed in, e.g., from DashboardPage
  marketData?: Ticker24hr[]
): Promise<void> {
  const botRunTimestamp = new Date().toISOString();
  const userId = userIdInput || DEMO_USER_ID_BOT_FALLBACK; // Ensure userId is always defined

  let settings: SettingsFormValues;

  if (currentSettings) {
    settings = currentSettings;
    console.log(`[${botRunTimestamp}] Bot cycle using PASSED-IN settings for user ${userId}.`);
  } else {
    try {
      // getSettings now guarantees returning SettingsFormValues
      settings = await getSettings(userId);
      console.log(`[${botRunTimestamp}] Bot cycle using FETCHED settings from database for user ${userId}.`);
    } catch (error) {
      console.error(`[${botRunTimestamp}] Bot: CRITICAL - Failed to load settings from database for user ${userId}. Error:`, error instanceof Error ? error.message : String(error), "Using emergency fallback defaults.");
      settings = {
        ...defaultSettingsValues,
        userId: userId, // Ensure userId is included
        isBotActive: false // Ensure bot is inactive by default in this critical fallback
      };
    }
  }

  let liveMarketData: Ticker24hr[];
  if (marketData) {
    liveMarketData = marketData;
  } else {
    const marketSymbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "XRPUSDT", "SOLUSDT"]; // Consider making this part of settings
    try {
      const tickerPromises = marketSymbols.map(symbol => get24hrTicker(symbol) as Promise<Ticker24hr | null>);
      const results = await Promise.all(tickerPromises);
      liveMarketData = results.filter(item => item !== null && !Array.isArray(item)) as Ticker24hr[];
    } catch (error) {
      console.error(`[${botRunTimestamp}] Bot: Failed to fetch live market data for independent cycle (user ${userId}):`, error);
      return;
    }
  }

  console.log(`[${botRunTimestamp}] Bot cycle STARTED for user ${userId}. Settings: Dip: ${settings.dipPercentage}%, Buy Amount: ${settings.buyAmountUsd}, Trail Profit: ${settings.trailActivationProfit}%, Trail Delta: ${settings.trailDelta}%, Active: ${settings.isBotActive}`);

  if (!settings.isBotActive) {
    console.log(`[${botRunTimestamp}] Bot is INACTIVE for user ${userId} according to settings. Skipping cycle.`);
    return;
  }

  if (!settings.binanceApiKey || !settings.binanceSecretKey) {
    console.warn(`[${botRunTimestamp}] Bot: User ${userId} has bot active but API keys are missing in settings. Skipping trading actions.`);
    // Optionally, still manage existing trades if they don't require new API calls for price checks,
    // but buying/selling would be disabled. For simplicity, we return here.
    return;
  }

  const activeTrades = await tradeService.getActiveTrades(userId);
  const activeTradeSymbols = activeTrades.map(t => t.symbol);

  console.log(`[${botRunTimestamp}] Bot (User ${userId}): Checking for potential buys...`);
  for (const ticker of liveMarketData) {
    const priceChangePercent = parseFloat(ticker.priceChangePercent);
    if (priceChangePercent <= settings.dipPercentage) {
      if (!activeTradeSymbols.includes(ticker.symbol)) {
        console.log(`[${botRunTimestamp}] Bot (User ${userId}): Potential DIP BUY for ${ticker.symbol} at ${ticker.lastPrice} (24hr change: ${priceChangePercent}%).`);

        const currentPrice = parseFloat(ticker.lastPrice);
        if (currentPrice <= 0) {
            console.warn(`[${botRunTimestamp}] Bot (User ${userId}): Invalid current price (<=0) for ${ticker.symbol}, skipping buy.`);
            continue;
        }
        const buyAmount = settings.buyAmountUsd;
        const quantityToBuy = buyAmount / currentPrice;
        const { baseAsset, quoteAsset } = getAssetsFromSymbol(ticker.symbol);

        try {
          // IMPORTANT: Actual buy order placement would use settings.binanceApiKey and settings.binanceSecretKey here.
          // For simulation, we just create a trade record.
          await tradeService.createTrade({
            userId: userId, // Associate trade with user
            symbol: ticker.symbol,
            baseAsset,
            quoteAsset,
            buyPrice: currentPrice,
            quantity: quantityToBuy,
          });
          console.log(`[${botRunTimestamp}] Bot (User ${userId}): SIMULATED BUY of ${quantityToBuy.toFixed(6)} ${baseAsset} (${ticker.symbol}) at $${currentPrice.toFixed(2)} for $${buyAmount}.`);
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
      // Price checks typically don't need user API keys if public ticker endpoint is used.
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
    const trailActivation = settings.trailActivationProfit;
    const trailDeltaVal = settings.trailDelta;

    if (trade.status === 'ACTIVE_BOUGHT') {
      if (profitPercentage >= trailActivation) {
        try {
          await tradeService.updateTrade(userId, trade.id, { // Pass userId
            status: 'ACTIVE_TRAILING',
            trailingHighPrice: currentPrice,
          });
          console.log(`[${botRunTimestamp}] Bot (User ${userId}): Trade ${trade.symbol} (ID: ${trade.id}) profit ${profitPercentage.toFixed(2)}% >= ${trailActivation}%. ACTIVATED TRAILING STOP at high price $${currentPrice.toFixed(2)}.`);
        } catch (error) {
          console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error updating trade ${trade.id} to TRAILING:`, error);
        }
      }
    } else if (trade.status === 'ACTIVE_TRAILING') {
      if (!trade.trailingHighPrice) {
        console.warn(`[${botRunTimestamp}] Bot (User ${userId}): Trade ${trade.symbol} (ID: ${trade.id}) is TRAILING but has no trailingHighPrice. Resetting with current price.`);
        try {
            await tradeService.updateTrade(userId, trade.id, { trailingHighPrice: currentPrice }); // Pass userId
        } catch (error) {
            console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error updating trailingHighPrice for ${trade.id}:`, error);
        }
        continue;
      }

      let newHighPrice = trade.trailingHighPrice;
      if (currentPrice > trade.trailingHighPrice) {
        newHighPrice = currentPrice;
        try {
            await tradeService.updateTrade(userId, trade.id, { trailingHighPrice: newHighPrice }); // Pass userId
            console.log(`[${botRunTimestamp}] Bot (User ${userId}): Trade ${trade.symbol} (ID: ${trade.id}) new high for trailing: $${newHighPrice.toFixed(2)}.`);
        } catch (error) {
            console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error updating new trailingHighPrice for ${trade.id}:`, error);
        }
      }

      const trailStopPrice = newHighPrice * (1 - trailDeltaVal / 100);
      if (currentPrice <= trailStopPrice) {
        const sellPrice = currentPrice;
        const pnl = (sellPrice - trade.buyPrice) * trade.quantity;
        const pnlPercentageValue = (trade.buyPrice * trade.quantity === 0) ? 0 : (pnl / (trade.buyPrice * trade.quantity)) * 100;
        try {
          // IMPORTANT: Actual sell order placement would use settings.binanceApiKey and settings.binanceSecretKey here.
          await tradeService.updateTrade(userId, trade.id, { // Pass userId
            status: 'CLOSED_SOLD',
            sellPrice: sellPrice,
            sellTimestamp: Date.now(),
            pnl: pnl,
            pnlPercentage: pnlPercentageValue,
          });
          console.log(`[${botRunTimestamp}] Bot (User ${userId}): SIMULATED SELL (Trailing Stop) of ${trade.quantity.toFixed(6)} ${trade.baseAsset} (${trade.symbol}) ID: ${trade.id} at $${sellPrice.toFixed(2)}. P&L: $${pnl.toFixed(2)} (${pnlPercentageValue.toFixed(2)}%). Stop: $${trailStopPrice.toFixed(2)} (High: $${newHighPrice.toFixed(2)})`);
        } catch (error) {
          console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error closing trade ${trade.id} via trailing stop:`, error);
           try {
             await tradeService.updateTrade(userId, trade.id, { status: 'CLOSED_ERROR', sellError: error instanceof Error ? error.message : String(error) }); // Pass userId
           } catch (dbError) {
             console.error(`[${botRunTimestamp}] Bot (User ${userId}): CRITICAL - Failed to mark trade ${trade.id} as error state after sell failure:`, dbError);
           }
        }
      }
    }
  }
  console.log(`[${botRunTimestamp}] Bot cycle ENDED for user ${userId}.`);
}
