
'use server';
/**
 * @fileOverview Core bot logic for making trading decisions using user-configurable or global strategy.
 */
import type { SettingsFormValues } from '@/components/settings/settings-form';
import { getSettings } from '@/services/settingsService';
import type { Ticker24hr } from '@/types/binance';
import type { Trade } from '@/types/trade';
import * as tradeService from '@/services/tradeService';
import { get24hrTicker } from '@/services/binance';
// Import global defaults for fallback, but user settings will take precedence.
import { 
    GLOBAL_DIP_PERCENTAGE as FALLBACK_DIP_PERCENTAGE,
    GLOBAL_BUY_AMOUNT_USD as FALLBACK_BUY_AMOUNT_USD,
    GLOBAL_TRAIL_ACTIVATION_PROFIT as FALLBACK_TRAIL_ACTIVATION_PROFIT,
    GLOBAL_TRAIL_DELTA as FALLBACK_TRAIL_DELTA,
    MONITORED_MARKET_SYMBOLS // Can remain global for now
} from '@/config/bot-strategy';
import { defaultSettingsValues } from '@/config/settings-defaults';


const DEMO_USER_ID_BOT_FALLBACK = "bot_fallback_user";

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

export async function runBotCycle(
  userIdInput: string,
  userApiSettings?: Pick<SettingsFormValues, 'binanceApiKey' | 'binanceSecretKey'>, // Only API keys can be optionally passed now
  marketData?: Ticker24hr[]
): Promise<void> {
  const botRunTimestamp = new Date().toISOString();
  const userId = userIdInput || DEMO_USER_ID_BOT_FALLBACK;

  console.log(`[${botRunTimestamp}] Bot (User ${userId}): runBotCycle invoked.`);

  let userSettings: SettingsFormValues;
  try {
    userSettings = await getSettings(userId);
    console.log(`[${botRunTimestamp}] Bot (User ${userId}): Successfully loaded full user settings. Dip%: ${userSettings.dipPercentage}, Buy Amount: ${userSettings.buyAmountUsd}`);
  } catch (error) {
    console.error(`[${botRunTimestamp}] Bot (User ${userId}): CRITICAL - Error loading user settings from database. Error:`, error instanceof Error ? error.message : String(error));
    console.warn(`[${botRunTimestamp}] Bot (User ${userId}): Bot cycle aborted due to settings load failure.`);
    return;
  }

  // Prioritize passed-in API keys if provided (e.g., from an initial dashboard load), otherwise use from loaded settings
  const apiKeyToUse = userApiSettings?.binanceApiKey || userSettings.binanceApiKey;
  const secretKeyToUse = userApiSettings?.binanceSecretKey || userSettings.binanceSecretKey;

  if (!apiKeyToUse || !secretKeyToUse) {
    console.warn(`[${botRunTimestamp}] Bot (User ${userId}): Missing API keys (checked passed-in and DB settings). Skipping trading actions.`);
    return;
  }
  console.log(`[${botRunTimestamp}] Bot (User ${userId}): API keys are PRESENT. Proceeding with trading actions.`);

  // Use user-configured strategy parameters, falling back to system defaults if necessary
  const dipPercentageToUse = typeof userSettings.dipPercentage === 'number' ? userSettings.dipPercentage : defaultSettingsValues.dipPercentage;
  const buyAmountUsdToUse = typeof userSettings.buyAmountUsd === 'number' && userSettings.buyAmountUsd > 0 ? userSettings.buyAmountUsd : defaultSettingsValues.buyAmountUsd;
  const trailActivationProfitToUse = typeof userSettings.trailActivationProfit === 'number' && userSettings.trailActivationProfit > 0 ? userSettings.trailActivationProfit : defaultSettingsValues.trailActivationProfit;
  const trailDeltaToUse = typeof userSettings.trailDelta === 'number' && userSettings.trailDelta > 0 ? userSettings.trailDelta : defaultSettingsValues.trailDelta;

  console.log(`[${botRunTimestamp}] Bot cycle STARTED for user ${userId}. Strategy: Dip: ${dipPercentageToUse}%, Buy Amount: $${buyAmountUsdToUse}, Trail Profit: ${trailActivationProfitToUse}%, Trail Delta: ${trailDeltaToUse}%`);

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

  console.log(`[${botRunTimestamp}] Bot (User ${userId}): Checking for potential buys (Dip ≤ ${dipPercentageToUse}%)...`);
  for (const ticker of liveMarketData) {
    const priceChangePercent = parseFloat(ticker.priceChangePercent);
    if (priceChangePercent <= dipPercentageToUse) {
      if (!activeTradeSymbols.includes(ticker.symbol)) {
        const currentPrice = parseFloat(ticker.lastPrice);
         if (currentPrice <= 0 || isNaN(currentPrice)) {
            console.warn(`[${botRunTimestamp}] Bot (User ${userId}): Invalid current price (${ticker.lastPrice} -> parsed as ${currentPrice}) for ${ticker.symbol}, skipping buy.`);
            continue;
        }
        console.log(`[${botRunTimestamp}] Bot (User ${userId}): Potential DIP BUY for ${ticker.symbol} at ${ticker.lastPrice} (24hr change: ${priceChangePercent}%). Buy amount: $${buyAmountUsdToUse}`);
        const quantityToBuy = buyAmountUsdToUse / currentPrice;
        const { baseAsset, quoteAsset } = getAssetsFromSymbol(ticker.symbol);

        try {
          // SIMULATION: Actual buy order would use apiKeyToUse and secretKeyToUse
          await tradeService.createTrade({
            userId: userId,
            symbol: ticker.symbol,
            baseAsset,
            quoteAsset,
            buyPrice: currentPrice,
            quantity: quantityToBuy,
          });
          console.log(`[${botRunTimestamp}] Bot (User ${userId}): DB TRADE RECORD CREATED for BUY of ${quantityToBuy.toFixed(6)} ${baseAsset} (${ticker.symbol}) at $${currentPrice.toFixed(2)} for $${buyAmountUsdToUse}.`);
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
     if (isNaN(currentPrice)) {
        console.warn(`[${botRunTimestamp}] Bot (User ${userId}): Invalid current price from ticker data for active trade ${trade.symbol} (value: ${currentTickerData.lastPrice}). Skipping management for this trade.`);
        continue;
    }
    const profitPercentage = ((currentPrice - trade.buyPrice) / trade.buyPrice) * 100;

    if (trade.status === 'ACTIVE_BOUGHT') {
      if (profitPercentage >= trailActivationProfitToUse) {
        try {
          await tradeService.updateTrade(userId, trade.id, {
            status: 'ACTIVE_TRAILING',
            trailingHighPrice: currentPrice,
          });
          console.log(`[${botRunTimestamp}] Bot (User ${userId}): Trade ${trade.symbol} (ID: ${trade.id}) profit ${profitPercentage.toFixed(2)}% >= ${trailActivationProfitToUse}%. ACTIVATED TRAILING STOP at high price $${currentPrice.toFixed(2)}.`);
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

      const trailStopPrice = newHighPrice * (1 - trailDeltaToUse / 100);
      if (currentPrice <= trailStopPrice) {
        const sellPrice = currentPrice;
        const pnl = (sellPrice - trade.buyPrice) * trade.quantity;
        const pnlPercentageValue = (trade.buyPrice * trade.quantity === 0) ? 0 : (pnl / (trade.buyPrice * trade.quantity)) * 100;
        try {
          // SIMULATION: Actual sell order would use apiKeyToUse and secretKeyToUse
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
