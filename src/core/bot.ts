
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
import { defaultSettingsValues } from '@/config/settings-defaults';
import { MONITORED_MARKET_SYMBOLS } from '@/config/bot-strategy';
import { 
    getLatestFootprintBars,
    getCurrentAggregatingBar,
} from '@/lib/footprint-aggregator';
import { calculateAllBotMetrics, type BotOrderFlowMetrics } from './botMetricCalculators';


const DEMO_USER_ID_BOT_FALLBACK = "bot_fallback_user";

function getAssetsFromSymbol(symbol: string): { baseAsset: string, quoteAsset: string } {
    const commonQuoteAssets = ['USDT', 'BUSD', 'TUSD', 'FDUSD'];
    for (const quote of commonQuoteAssets) {
        if (symbol.endsWith(quote)) {
            return { baseAsset: symbol.slice(0, -quote.length), quoteAsset: quote };
        }
    }
    // Fallback for other pairs (e.g., BTC pairs)
    // This logic might need refinement for pairs like ETHBTC
    if (symbol.length > 3 && (symbol.endsWith('BTC') || symbol.endsWith('ETH') )) { // Add other common quote assets if needed
        const knownQuote = symbol.endsWith('BTC') ? 'BTC' : 'ETH';
         if (symbol.length > knownQuote.length && symbol.endsWith(knownQuote)) {
            return { baseAsset: symbol.slice(0, -knownQuote.length), quoteAsset: knownQuote };
        }
    }
    // Default/fallback if no common quote asset is identified clearly
    return { baseAsset: symbol.length > 3 ? symbol.slice(0, symbol.length - 3) : symbol, quoteAsset: symbol.length > 3 ? symbol.slice(-3) : 'UNKNOWN' };
}

export async function runBotCycle(
  userIdInput: string,
  userApiSettings?: Pick<SettingsFormValues, 'binanceApiKey' | 'binanceSecretKey'>,
  marketData?: Ticker24hr[]
): Promise<void> {
  const botRunTimestamp = new Date().toISOString();
  const userId = userIdInput || DEMO_USER_ID_BOT_FALLBACK;

  console.log(`[${botRunTimestamp}] Bot (User ${userId}): runBotCycle invoked.`);

  let userSettings: SettingsFormValues;
  try {
    userSettings = await getSettings(userId);
  } catch (error) {
    console.error(`[${botRunTimestamp}] Bot (User ${userId}): CRITICAL - Error loading user settings. Error:`, error instanceof Error ? error.message : String(error));
    return;
  }

  const apiKeyToUse = userApiSettings?.binanceApiKey || userSettings.binanceApiKey;
  const secretKeyToUse = userApiSettings?.binanceSecretKey || userSettings.binanceSecretKey;

  if (!apiKeyToUse || !secretKeyToUse) {
    console.warn(`[${botRunTimestamp}] Bot (User ${userId}): Missing API keys. Skipping trading actions.`);
    return;
  }

  // const dipPercentageToUse = typeof userSettings.dipPercentage === 'number' ? userSettings.dipPercentage : defaultSettingsValues.dipPercentage; // Kept for reference, but replaced by metrics logic
  const buyAmountUsdToUse = typeof userSettings.buyAmountUsd === 'number' && userSettings.buyAmountUsd > 0 ? userSettings.buyAmountUsd : defaultSettingsValues.buyAmountUsd;
  const trailActivationProfitToUse = typeof userSettings.trailActivationProfit === 'number' && userSettings.trailActivationProfit > 0 ? userSettings.trailActivationProfit : defaultSettingsValues.trailActivationProfit;
  const trailDeltaToUse = typeof userSettings.trailDelta === 'number' && userSettings.trailDelta > 0 ? userSettings.trailDelta : defaultSettingsValues.trailDelta;

  console.log(`[${botRunTimestamp}] Bot cycle STARTED for user ${userId}. Strategy (General Params): BuyAmt: $${buyAmountUsdToUse}, TrailProfit: ${trailActivationProfitToUse}%, TrailDelta: ${trailDeltaToUse}%`);

  let liveMarketData: Ticker24hr[];
  if (marketData) {
    liveMarketData = marketData;
  } else {
    try {
      const tickerPromises = MONITORED_MARKET_SYMBOLS.map(symbol => get24hrTicker(symbol).catch(e => {
          console.error(`[${botRunTimestamp}] Bot (User ${userId}): Failed to fetch ticker for ${symbol} during market data gathering:`, e instanceof Error ? e.message : String(e));
          return null; // Return null on error for this symbol
      }));
      const results = await Promise.all(tickerPromises);
      liveMarketData = results.filter(item => item !== null && !Array.isArray(item)) as Ticker24hr[];
       if(liveMarketData.length !== MONITORED_MARKET_SYMBOLS.length) {
          console.warn(`[${botRunTimestamp}] Bot (User ${userId}): Discrepancy in fetched market data. Expected ${MONITORED_MARKET_SYMBOLS.length}, got ${liveMarketData.length}. Some symbols might be unavailable.`);
      }
    } catch (error) {
      console.error(`[${botRunTimestamp}] Bot (User ${userId}): Overall failure to fetch live market data:`, error);
      return;
    }
  }

  const activeTrades = await tradeService.getActiveTrades(userId);
  const activeTradeSymbols = activeTrades.map(t => t.symbol);

  console.log(`[${botRunTimestamp}] Bot (User ${userId}): Analyzing ${MONITORED_MARKET_SYMBOLS.length} monitored symbols.`);

  for (const symbol of MONITORED_MARKET_SYMBOLS) {
    const currentTicker = liveMarketData.find(t => t.symbol === symbol);
    if (!currentTicker) {
      console.warn(`[${botRunTimestamp}] Bot (User ${userId}): No live ticker data found for ${symbol} in fetched market data. Skipping.`);
      continue;
    }
    const currentPrice = parseFloat(currentTicker.lastPrice);
    if (isNaN(currentPrice) || currentPrice <= 0) {
      console.warn(`[${botRunTimestamp}] Bot (User ${userId}): Invalid current price (${currentTicker.lastPrice}) for ${symbol}. Skipping.`);
      continue;
    }

    // Fetch footprint data
    const completedFootprintBars = getLatestFootprintBars(symbol, 20); // Get last ~20 bars for analysis
    const currentAggregatingBar = getCurrentAggregatingBar(symbol);

    if (completedFootprintBars.length < 5) { 
      console.log(`[${botRunTimestamp}] Bot (User ${userId}) [${symbol}]: Not enough completed footprint bars (${completedFootprintBars.length}) for robust metric calculation. Skipping advanced decisions.`);
      continue;
    }
    
    // Calculate order flow metrics
    const metrics: BotOrderFlowMetrics = await calculateAllBotMetrics(completedFootprintBars, currentAggregatingBar);

    console.log(`[${botRunTimestamp}] Bot (User ${userId}) [${symbol}]: Metrics: Price=${currentPrice.toFixed(4)}, VAL=${metrics.sessionVal?.toFixed(4)}, POC=${metrics.sessionPoc?.toFixed(4)}, BarChar='${metrics.latestBarCharacter}', Divergence='${metrics.divergenceSignals.join(', ') || 'None'}'`);

    const existingTradeForSymbol = activeTrades.find(t => t.symbol === symbol);

    if (!existingTradeForSymbol) {
      // === NEW ENTRY LOGIC ===
      let entryReason = "";
      
      // Condition 1: Price near Session VAL
      const val = metrics.sessionVal;
      let priceNearVal = false;
      if (val !== null) {
        const valThresholdUpper = val * (1 + 0.002); // VAL + 0.2%
        // Check if current price is within VAL and VAL + 0.2%, or if low of current bar touched VAL
        priceNearVal = (currentPrice >= val && currentPrice <= valThresholdUpper);
        if (!priceNearVal && currentAggregatingBar?.low) { // Consider current bar's low
            priceNearVal = currentAggregatingBar.low <= val;
        }
         if (!priceNearVal && completedFootprintBars.length > 0) { // Consider last completed bar's low
            const lastCompletedBar = completedFootprintBars[completedFootprintBars.length -1];
            if(lastCompletedBar.low <= val) priceNearVal = true;
        }
      }

      // Condition 2: Bullish Bar Character
      const isBullishBarCharacter = metrics.latestBarCharacter === "Price Buy" || metrics.latestBarCharacter === "Delta Buy";

      if (priceNearVal && isBullishBarCharacter) {
        entryReason = `Price near VAL (${val?.toFixed(4)}) & Bullish Bar Character ('${metrics.latestBarCharacter}')`;
      }

      // Potentially add more conditions / entry reasons based on other metrics (e.g., divergence)
      // Example: 
      // if (metrics.divergenceSignals.includes("Bullish Delta Divergence") && isBullishBarCharacter) {
      //    entryReason = `Bullish Delta Divergence & Bullish Bar Character ('${metrics.latestBarCharacter}')`;
      // }


      if (entryReason && !activeTradeSymbols.includes(symbol)) { // Ensure we don't double buy
           console.log(`[${botRunTimestamp}] Bot (User ${userId}): METRICS-BASED BUY SIGNAL for ${symbol} at ${currentPrice.toFixed(4)}. Reason: ${entryReason}. Amount: $${buyAmountUsdToUse}`);
           const quantityToBuy = buyAmountUsdToUse / currentPrice;
           const { baseAsset, quoteAsset } = getAssetsFromSymbol(symbol);
           try {
             await tradeService.createTrade({
               userId: userId,
               symbol: symbol,
               baseAsset,
               quoteAsset,
               buyPrice: currentPrice,
               quantity: quantityToBuy,
             });
             console.log(`[${botRunTimestamp}] Bot (User ${userId}): DB TRADE RECORD CREATED for BUY of ${quantityToBuy.toFixed(6)} ${baseAsset} (${symbol}) at $${currentPrice.toFixed(4)}.`);
             activeTradeSymbols.push(symbol); // Add to list to prevent immediate re-buy in same cycle
           } catch (error) {
             console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error creating trade record for ${symbol}:`, error);
           }
      }
      // --- Old dip buying logic (can be removed or kept as a fallback if desired) ---
      // const priceChangePercent = parseFloat(currentTicker.priceChangePercent);
      // if (priceChangePercent <= dipPercentageToUse) { 
      //   if (!activeTradeSymbols.includes(symbol)) { 
      //      console.log(`[${botRunTimestamp}] Bot (User ${userId}): FALLBACK DIP BUY SIGNAL for ${symbol} at ${currentPrice.toFixed(2)} (24hr change: ${priceChangePercent}%). Amount: $${buyAmountUsdToUse}`);
      //      // ... create trade logic ...
      //   }
      // }
    } else {
      // === POSITION MANAGEMENT & EXIT LOGIC (for existing trades) ===
      // This section will primarily use the existing trailing stop logic.
      // Proactive exits based on 'metrics' could be added here.
      // console.log(`[${botRunTimestamp}] Bot (User ${userId}) [${symbol}]: Has existing trade. Trailing stop logic will manage.`);
    }
  } // End of MONITORED_MARKET_SYMBOLS loop

  // --- Manage All Active Trades (Mainly for Trailing Stops) ---
  // Refetch active trades in case new ones were created in the loop above
  const currentActiveTrades = await tradeService.getActiveTrades(userId);
  if (currentActiveTrades.length > 0) {
      console.log(`[${botRunTimestamp}] Bot (User ${userId}): Managing ${currentActiveTrades.length} active bot trades for stop-loss/trailing...`);
  }

  for (const trade of currentActiveTrades) {
    // Ensure we have the latest price for this specific active trade
    const activeTradeTickerData = liveMarketData.find(t => t.symbol === trade.symbol);
    if (!activeTradeTickerData) {
      console.warn(`[${botRunTimestamp}] Bot (User ${userId}): No live ticker data for active trade ${trade.symbol} during management. Skipping this trade.`);
      continue;
    }
    const currentPriceForTrade = parseFloat(activeTradeTickerData.lastPrice);
    if (isNaN(currentPriceForTrade) || currentPriceForTrade <= 0) {
      console.warn(`[${botRunTimestamp}] Bot (User ${userId}): Invalid current price (${activeTradeTickerData.lastPrice}) for active trade ${trade.symbol} during management. Skipping.`);
      continue;
    }

    const profitPercentage = ((currentPriceForTrade - trade.buyPrice) / trade.buyPrice) * 100;

    if (trade.status === 'ACTIVE_BOUGHT') {
      if (profitPercentage >= trailActivationProfitToUse) {
        try {
          await tradeService.updateTrade(userId, trade.id, {
            status: 'ACTIVE_TRAILING',
            trailingHighPrice: currentPriceForTrade,
          });
          console.log(`[${botRunTimestamp}] Bot (User ${userId}): Trade ${trade.symbol} (ID: ${trade.id}) profit ${profitPercentage.toFixed(2)}% >= ${trailActivationProfitToUse}%. ACTIVATED TRAILING STOP at high $${currentPriceForTrade.toFixed(4)}.`);
        } catch (error) {
          console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error updating trade ${trade.id} to TRAILING:`, error);
        }
      }
      // TODO: Add initial hard stop-loss logic here if desired
      // e.g., if (profitPercentage <= -HARD_STOP_LOSS_PERCENTAGE) { sell }

    } else if (trade.status === 'ACTIVE_TRAILING') {
      if (trade.trailingHighPrice === undefined || trade.trailingHighPrice === null) {
        console.warn(`[${botRunTimestamp}] Bot (User ${userId}): Trade ${trade.symbol} (ID: ${trade.id}) TRAILING but invalid trailingHighPrice. Resetting with current $${currentPriceForTrade.toFixed(4)}.`);
        try {
            await tradeService.updateTrade(userId, trade.id, { trailingHighPrice: currentPriceForTrade });
        } catch (error) {
             console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error resetting trailingHighPrice for ${trade.id}:`, error);
        }
        continue; 
      }

      let newHighPrice = trade.trailingHighPrice;
      if (currentPriceForTrade > trade.trailingHighPrice) {
        newHighPrice = currentPriceForTrade;
        try {
            await tradeService.updateTrade(userId, trade.id, { trailingHighPrice: newHighPrice });
            console.log(`[${botRunTimestamp}] Bot (User ${userId}): Trade ${trade.symbol} (ID: ${trade.id}) new high for trailing: $${newHighPrice.toFixed(4)}.`);
        } catch (error) {
            console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error updating new trailingHighPrice for ${trade.id}:`, error);
        }
      }

      const trailStopPrice = newHighPrice * (1 - trailDeltaToUse / 100);
      if (currentPriceForTrade <= trailStopPrice) {
        const sellPrice = currentPriceForTrade; // Sell at current market price
        const pnlValue = (sellPrice - trade.buyPrice) * trade.quantity;
        const pnlPercentageValue = (trade.buyPrice * trade.quantity === 0) ? 0 : (pnlValue / (trade.buyPrice * trade.quantity)) * 100;
        try {
          await tradeService.updateTrade(userId, trade.id, {
            status: 'CLOSED_SOLD',
            sellPrice: sellPrice,
            sellTimestamp: Date.now(),
            pnl: pnlValue,
            pnlPercentage: pnlPercentageValue,
          });
          console.log(`[${botRunTimestamp}] Bot (User ${userId}): SOLD (Trailing Stop) ${trade.quantity.toFixed(6)} ${trade.baseAsset} (${trade.symbol}) ID ${trade.id} at $${sellPrice.toFixed(4)}. P&L: $${pnlValue.toFixed(2)} (${pnlPercentageValue.toFixed(2)}%). Stop: $${trailStopPrice.toFixed(4)}, High: $${newHighPrice.toFixed(4)}.`);
        } catch (error) {
          console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error closing trade ${trade.id} via trailing stop:`, error);
           try {
             await tradeService.updateTrade(userId, trade.id, { status: 'CLOSED_ERROR', sellError: error instanceof Error ? error.message : String(error) });
           } catch (dbError) {
             console.error(`[${botRunTimestamp}] Bot (User ${userId}): CRITICAL - Failed to mark trade ${trade.id} as error after sell failure:`, dbError);
           }
        }
      }
    }
  }
  console.log(`[${botRunTimestamp}] Bot cycle ENDED for user ${userId}.`);
}
