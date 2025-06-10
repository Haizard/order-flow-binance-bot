
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
    MONITORED_MARKET_SYMBOLS
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
        const potentialBase3 = symbol.substring(0, symbol.length - 3);
        const potentialQuote3 = symbol.substring(symbol.length - 3);
        if (potentialQuote3.length === 3) return {baseAsset: potentialBase3, quoteAsset: potentialQuote3};

        if (symbol.length > 4) { 
            const potentialBase4 = symbol.substring(0, symbol.length - 4);
            const potentialQuote4 = symbol.substring(symbol.length - 4);
            if (potentialQuote4.length === 4) return {baseAsset: potentialBase4, quoteAsset: potentialQuote4};
        }
    }
    return { baseAsset: symbol.length > 3 ? symbol.slice(0, 3) : symbol, quoteAsset: symbol.length > 3 ? symbol.slice(3) : 'UNKNOWN' };
}

interface UserApiKeys {
  binanceApiKey?: string;
  binanceSecretKey?: string;
}

export async function runBotCycle(
  userIdInput: string,
  userApiSettings?: UserApiKeys, 
  marketData?: Ticker24hr[]
): Promise<void> {
  const botRunTimestamp = new Date().toISOString();
  const userId = userIdInput || DEMO_USER_ID_BOT_FALLBACK;

  console.log(`[${botRunTimestamp}] Bot (User ${userId}): runBotCycle invoked. API Key in received userApiSettings: ${userApiSettings?.binanceApiKey ? 'Exists (length ' + userApiSettings.binanceApiKey.length + ')' : 'MISSING'}, Secret Key in received userApiSettings: ${userApiSettings?.binanceSecretKey ? 'Exists (length ' + userApiSettings.binanceSecretKey.length + ')' : 'MISSING'}`);

  let apiKeys: UserApiKeys = {}; 

  if (userApiSettings && userApiSettings.binanceApiKey && userApiSettings.binanceSecretKey) {
    apiKeys = userApiSettings;
    console.log(`[${botRunTimestamp}] Bot (User ${userId}): Using PASSED-IN API keys. API Key Present: ${!!apiKeys.binanceApiKey}, Secret Key Present: ${!!apiKeys.binanceSecretKey}`);
  } else {
    console.log(`[${botRunTimestamp}] Bot (User ${userId}): Passed-in API keys not available or incomplete from userApiSettings. Attempting to fetch from database.`);
    try {
      const fullUserSettingsFromDb = await getSettings(userId); 
      if (fullUserSettingsFromDb.binanceApiKey && fullUserSettingsFromDb.binanceSecretKey) {
        apiKeys = {
          binanceApiKey: fullUserSettingsFromDb.binanceApiKey,
          binanceSecretKey: fullUserSettingsFromDb.binanceSecretKey,
        };
        console.log(`[${botRunTimestamp}] Bot (User ${userId}): Successfully FETCHED API keys from database. API Key Present: ${!!apiKeys.binanceApiKey} (len: ${apiKeys.binanceApiKey?.length}), Secret Key Present: ${!!apiKeys.binanceSecretKey} (len: ${apiKeys.binanceSecretKey?.length})`);
      } else {
        console.warn(`[${botRunTimestamp}] Bot (User ${userId}): API keys not found or incomplete in database (after fetch). Will skip trading actions. DB API Key length: ${fullUserSettingsFromDb.binanceApiKey?.length || 0}`);
        // apiKeys remains {}
      }
    } catch (error) {
      console.error(`[${botRunTimestamp}] Bot (User ${userId}): CRITICAL - Error loading API key settings from database. Error:`, error instanceof Error ? error.message : String(error));
      // apiKeys remains {}
    }
  }

  console.log(`[${botRunTimestamp}] Bot cycle STARTED for user ${userId}. Global Strategy: Dip: ${GLOBAL_DIP_PERCENTAGE}%, Buy Amount: ${GLOBAL_BUY_AMOUNT_USD}, Trail Profit: ${GLOBAL_TRAIL_ACTIVATION_PROFIT}%, Trail Delta: ${GLOBAL_TRAIL_DELTA}%`);

  if (!apiKeys.binanceApiKey || !apiKeys.binanceSecretKey) {
    console.warn(`[${botRunTimestamp}] Bot (User ${userId}): FINAL CHECK - Missing API keys. Skipping trading actions for this user.`);
    return;
  }
  console.log(`[${botRunTimestamp}] Bot (User ${userId}): API keys are PRESENT. Proceeding with trading actions.`);


  let liveMarketData: Ticker24hr[];
  if (marketData) {
    liveMarketData = marketData;
  } else {
    try {
      const tickerPromises = MONITORED_MARKET_SYMBOLS.map(symbol => get24hrTicker(symbol) as Promise<Ticker24hr | null>);
      const results = await Promise.all(tickerPromises);
      liveMarketData = results.filter(item => item !== null && !Array.isArray(item)) as Ticker24hr[];
    } catch (error) {
      console.error(`[${botRunTimestamp}] Bot (User ${userId}): Failed to fetch live market data for independent cycle:`, error);
      return; 
    }
  }

  const activeTrades = await tradeService.getActiveTrades(userId);
  const activeTradeSymbols = activeTrades.map(t => t.symbol);

  console.log(`[${botRunTimestamp}] Bot (User ${userId}): Checking for potential buys (Dip ≤ ${GLOBAL_DIP_PERCENTAGE}%)...`);
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
          // --- SIMULATED BINANCE BUY ORDER ---
          // const buyOrderResult = await placeBuyOrder(apiKeys.binanceApiKey, apiKeys.binanceSecretKey, ticker.symbol, quantityToBuy);
          // console.log(`[${botRunTimestamp}] Bot (User ${userId}): ACTUAL BUY ORDER for ${ticker.symbol} would be placed here using user's keys. Result: ${buyOrderResult}`);
          // --- END SIMULATION ---

          await tradeService.createTrade({
            userId: userId,
            symbol: ticker.symbol,
            baseAsset,
            quoteAsset,
            buyPrice: currentPrice,
            quantity: quantityToBuy,
          });
          console.log(`[${botRunTimestamp}] Bot (User ${userId}): DB TRADE RECORD CREATED for BUY of ${quantityToBuy.toFixed(6)} ${baseAsset} (${ticker.symbol}) at $${currentPrice.toFixed(2)} for $${GLOBAL_BUY_AMOUNT_USD}.`);
        } catch (error) {
          console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error creating trade record for ${ticker.symbol}:`, error);
        }
      }
    }
  }

  console.log(`[${botRunTimestamp}] Bot (User ${userId}): Managing ${activeTrades.length} active trades...`);
  for (const trade of activeTrades) {
    let currentTickerData: Ticker24hr | null = null;
    try {
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
      if (trade.trailingHighPrice === undefined || trade.trailingHighPrice === null) { 
        console.warn(`[${botRunTimestamp}] Bot (User ${userId}): Trade ${trade.symbol} (ID: ${trade.id}) is TRAILING but has no/invalid trailingHighPrice (${trade.trailingHighPrice}). Resetting with current price $${currentPrice.toFixed(2)}.`);
        try {
            await tradeService.updateTrade(userId, trade.id, { trailingHighPrice: currentPrice });
        } catch (error) {
            console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error updating/resetting trailingHighPrice for ${trade.id}:`, error);
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
          // --- SIMULATED BINANCE SELL ORDER ---
          // const sellOrderResult = await placeSellOrder(apiKeys.binanceApiKey, apiKeys.binanceSecretKey, trade.symbol, trade.quantity);
          // console.log(`[${botRunTimestamp}] Bot (User ${userId}): ACTUAL SELL ORDER for ${trade.symbol} would be placed here using user's keys. Result: ${sellOrderResult}`);
          // --- END SIMULATION ---
          
          await tradeService.updateTrade(userId, trade.id, {
            status: 'CLOSED_SOLD',
            sellPrice: sellPrice,
            sellTimestamp: Date.now(),
            pnl: pnl,
            pnlPercentage: pnlPercentageValue,
          });
          console.log(`[${botRunTimestamp}] Bot (User ${userId}): DB TRADE RECORD UPDATED for SELL (Trailing Stop) of ${trade.quantity.toFixed(6)} ${trade.baseAsset} (${trade.symbol}) ID: ${trade.id} at $${sellPrice.toFixed(2)}. P&L: $${pnl.toFixed(2)} (${pnlPercentageValue.toFixed(2)}%). Stop: $${trailStopPrice.toFixed(2)} (High: $${newHighPrice.toFixed(2)})`);
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

