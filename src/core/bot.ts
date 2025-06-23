
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
const FOOTPRINT_BARS_FOR_METRICS = 20; 
const MIN_FOOTPRINT_BARS_FOR_ACTION = 10; // Increased for more reliable reversal/divergence signals
const INITIAL_STOP_LOSS_PERCENTAGE = 1.5; // e.g., 1.5% initial stop loss

function getAssetsFromSymbol(symbol: string): { baseAsset: string, quoteAsset: string } {
    const commonQuoteAssets = ['USDT', 'BUSD', 'TUSD', 'FDUSD'];
    for (const quote of commonQuoteAssets) {
        if (symbol.endsWith(quote)) {
            return { baseAsset: symbol.slice(0, -quote.length), quoteAsset: quote };
        }
    }
    if (symbol.length > 3 && (symbol.endsWith('BTC') || symbol.endsWith('ETH') )) {
        const knownQuote = symbol.endsWith('BTC') ? 'BTC' : 'ETH';
         if (symbol.length > knownQuote.length && symbol.endsWith(knownQuote)) {
            return { baseAsset: symbol.slice(0, -knownQuote.length), quoteAsset: knownQuote };
        }
    }
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

  // Use user-configured settings with fallbacks to defaults
  const buyAmountUsdToUse = userSettings.buyAmountUsd ?? defaultSettingsValues.buyAmountUsd;
  const trailActivationProfitToUse = userSettings.trailActivationProfit ?? defaultSettingsValues.trailActivationProfit;
  const trailDeltaToUse = userSettings.trailDelta ?? defaultSettingsValues.trailDelta;
  const maxActiveTradesToUse = userSettings.maxActiveTrades ?? defaultSettingsValues.maxActiveTrades;
  
  console.log(`[${botRunTimestamp}] Bot cycle STARTED for user ${userId}. Strategy Params: BuyAmt: $${buyAmountUsdToUse}, TrailProfit: ${trailActivationProfitToUse}%, TrailDelta: ${trailDeltaToUse}%, InitStopLoss: ${INITIAL_STOP_LOSS_PERCENTAGE}%, MaxTrades: ${maxActiveTradesToUse}`);

  let liveMarketData: Ticker24hr[];
  if (marketData) {
    liveMarketData = marketData;
  } else {
    try {
      const tickerPromises = MONITORED_MARKET_SYMBOLS.map(symbol => get24hrTicker(symbol).catch(e => {
          console.error(`[${botRunTimestamp}] Bot (User ${userId}): Failed to fetch ticker for ${symbol} during market data gathering:`, e instanceof Error ? e.message : String(e));
          return null;
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

  const activeTradesFromDb = await tradeService.getActiveTrades(userId);
  const activeTradeSymbols = activeTradesFromDb.map(t => t.symbol);
  
  console.log(`[${botRunTimestamp}] Bot (User ${userId}): Found ${activeTradesFromDb.length} active trade(s). Max allowed: ${maxActiveTradesToUse}.`);

  const canOpenNewTrade = activeTradesFromDb.length < maxActiveTradesToUse;

  if (canOpenNewTrade) {
    console.log(`[${botRunTimestamp}] Bot (User ${userId}): Analyzing ${MONITORED_MARKET_SYMBOLS.length} monitored symbols for new entries.`);

    for (const symbol of MONITORED_MARKET_SYMBOLS) {
        if (activeTradeSymbols.includes(symbol)) {
            continue; // Skip if there's already an active trade for this symbol
        }

        const currentTicker = liveMarketData.find(t => t.symbol === symbol);
        if (!currentTicker) {
        continue;
        }
        const currentPrice = parseFloat(currentTicker.lastPrice);
        if (isNaN(currentPrice) || currentPrice <= 0) {
        console.warn(`[${botRunTimestamp}] Bot (User ${userId}): Invalid current price (${currentTicker.lastPrice}) for ${symbol}. Skipping.`);
        continue;
        }

        const completedFootprintBars = getLatestFootprintBars(symbol, FOOTPRINT_BARS_FOR_METRICS);
        const currentAggregatingBar = getCurrentAggregatingBar(symbol);

        if (completedFootprintBars.length < MIN_FOOTPRINT_BARS_FOR_ACTION) { 
        continue;
        }
        
        const metrics: BotOrderFlowMetrics = await calculateAllBotMetrics(completedFootprintBars, currentAggregatingBar);
        if (metrics.sessionVwap) { // Check if VWAP was calculated
            console.log(`[${botRunTimestamp}] Bot (User ${userId}): [${symbol}] Calculated Session VWAP: ${metrics.sessionVwap.toFixed(4)}`);
        }

        const { sessionVal, sessionVah, latestBarCharacter, divergenceSignals, imbalanceReversalSignal } = metrics;
        
        // --- LONG ENTRY LOGIC ---
        const isBullishBarCharacter = latestBarCharacter === "Price Buy" || latestBarCharacter === "Delta Buy";
        const val = sessionVal;
        let priceNearVal = false;
        if (val !== null) {
            const valThresholdUpper = val * (1 + 0.002);
            priceNearVal = (currentPrice >= val && currentPrice <= valThresholdUpper);
            if (!priceNearVal && currentAggregatingBar?.low) priceNearVal = currentAggregatingBar.low <= val;
            if (!priceNearVal && completedFootprintBars.length > 0) {
                const lastCompletedBar = completedFootprintBars[completedFootprintBars.length - 1]; 
                if(lastCompletedBar.low <= val) priceNearVal = true;
            }
        }

        let shouldBuyLong = false;
        let longEntryReason = "";
        if (priceNearVal && isBullishBarCharacter) {
            shouldBuyLong = true;
            longEntryReason = `Price near VAL (${val?.toFixed(4)}) & Bullish Bar Character ('${latestBarCharacter}')`;
        } else if (divergenceSignals.includes("Bullish Delta Divergence") && isBullishBarCharacter) {
            shouldBuyLong = true;
            longEntryReason = `Bullish Delta Divergence & Bullish Bar Character ('${latestBarCharacter}')`;
        } else if (imbalanceReversalSignal === 'BULLISH_IMBALANCE_REVERSAL') {
            shouldBuyLong = true;
            longEntryReason = 'Bullish Imbalance Reversal Detected';
        }
        
        if (shouldBuyLong) {
            const entryPrice = currentPrice;
            const initialStopLossPrice = entryPrice * (1 - INITIAL_STOP_LOSS_PERCENTAGE / 100);
            console.log(`[${botRunTimestamp}] Bot (User ${userId}): LONG ENTRY SIGNAL for ${symbol} at ${entryPrice.toFixed(4)}. Reason: ${longEntryReason}.`);
            const quantityToBuy = buyAmountUsdToUse / entryPrice;
            const { baseAsset, quoteAsset } = getAssetsFromSymbol(symbol);
            try {
                await tradeService.createTrade({
                userId: userId,
                symbol: symbol,
                baseAsset,
                quoteAsset,
                entryPrice,
                quantity: quantityToBuy,
                initialStopLossPrice: initialStopLossPrice,
                tradeDirection: 'LONG',
                });
                console.log(`[${botRunTimestamp}] Bot (User ${userId}): DB TRADE RECORD CREATED for LONG of ${quantityToBuy.toFixed(6)} ${baseAsset} (${symbol}).`);
                activeTradeSymbols.push(symbol); 
                if (activeTradeSymbols.length >= maxActiveTradesToUse) break; // Stop looking for new trades if limit is hit mid-cycle
            } catch (error) {
                console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error creating LONG trade record for ${symbol}:`, error);
            }
        }

        // --- SHORT ENTRY LOGIC ---
        const isBearishBarCharacter = latestBarCharacter === "Price Sell" || latestBarCharacter === "Delta Sell";
        const vah = sessionVah;
        let priceNearVah = false;
        if (vah !== null) {
            const vahThresholdLower = vah * (1 - 0.002);
            priceNearVah = (currentPrice >= vahThresholdLower && currentPrice <= vah);
            if (!priceNearVah && currentAggregatingBar?.high) priceNearVah = currentAggregatingBar.high >= vah;
            if (!priceNearVah && completedFootprintBars.length > 0) {
                const lastCompleted = completedFootprintBars[completedFootprintBars.length - 1]; 
                if (lastCompleted.high >= vah) priceNearVah = true;
            }
        }

        let shouldSellShort = false;
        let shortEntryReason = "";
        if (priceNearVah && isBearishBarCharacter) {
            shouldSellShort = true;
            shortEntryReason = `Price near VAH (${vah?.toFixed(4)}) & Bearish Bar Character ('${latestBarCharacter}')`;
        } else if (divergenceSignals.includes("Bearish Delta Divergence") && isBearishBarCharacter) {
            shouldSellShort = true;
            shortEntryReason = `Bearish Delta Divergence & Bearish Bar Character ('${latestBarCharacter}')`;
        } else if (imbalanceReversalSignal === 'BEARISH_IMBALANCE_REVERSAL') {
            shouldSellShort = true;
            shortEntryReason = 'Bearish Imbalance Reversal Detected';
        }

        if (shouldSellShort) {
            const entryPrice = currentPrice;
            const initialStopLossPrice = entryPrice * (1 + INITIAL_STOP_LOSS_PERCENTAGE / 100);
            console.log(`[${botRunTimestamp}] Bot (User ${userId}): SHORT ENTRY SIGNAL for ${symbol} at ${entryPrice.toFixed(4)}. Reason: ${shortEntryReason}.`);
            const quantityToSell = buyAmountUsdToUse / entryPrice;
            const { baseAsset, quoteAsset } = getAssetsFromSymbol(symbol);
            try {
                await tradeService.createTrade({
                userId: userId,
                symbol: symbol,
                baseAsset,
                quoteAsset,
                entryPrice,
                quantity: quantityToSell,
                initialStopLossPrice: initialStopLossPrice,
                tradeDirection: 'SHORT',
                });
                console.log(`[${botRunTimestamp}] Bot (User ${userId}): DB TRADE RECORD CREATED for SHORT of ${quantityToSell.toFixed(6)} ${baseAsset} (${symbol}).`);
                activeTradeSymbols.push(symbol); 
                if (activeTradeSymbols.length >= maxActiveTradesToUse) break; // Stop looking for new trades if limit is hit mid-cycle
            } catch (error) {
                console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error creating SHORT trade record for ${symbol}:`, error);
            }
        }
    }
  } else if (activeTradesFromDb.length > 0) {
      console.log(`[${botRunTimestamp}] Bot (User ${userId}): Max active trades limit reached. Skipping new entry analysis for this cycle.`);
  }

  if (activeTradesFromDb.length > 0) {
      console.log(`[${botRunTimestamp}] Bot (User ${userId}): Managing ${activeTradesFromDb.length} active bot trades for exits/trailing...`);
  }

  for (const trade of activeTradesFromDb) {
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

    // --- LONG TRADE MANAGEMENT ---
    if (trade.tradeDirection === 'LONG') {
        // Initial SL Check for Long
        if (trade.status === 'ACTIVE_LONG_ENTRY' && trade.initialStopLossPrice && currentPriceForTrade <= trade.initialStopLossPrice) {
            const exitPrice = trade.initialStopLossPrice;
            const pnlValue = (exitPrice - trade.entryPrice) * trade.quantity;
            const pnlPercentageValue = (trade.entryPrice * trade.quantity === 0) ? 0 : (pnlValue / (trade.entryPrice * trade.quantity)) * 100;
            
            console.log(`[${botRunTimestamp}] Bot (User ${userId}): LONG INITIAL STOP-LOSS HIT for ${trade.symbol} ID ${trade.id}. Selling at $${exitPrice.toFixed(4)}.`);
            try {
              await tradeService.updateTrade(userId, trade.id, {
                status: 'CLOSED_EXITED',
                exitPrice,
                pnl: pnlValue,
                pnlPercentage: pnlPercentageValue,
              });
            } catch (error) {
              console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error closing LONG trade ${trade.id} via initial SL:`, error);
              await tradeService.updateTrade(userId, trade.id, { status: 'CLOSED_ERROR', sellError: error instanceof Error ? error.message : String(error) });
            }
            continue;
        }

        // Proactive Exit Logic for Long
        const activeTradeFootprintBars = getLatestFootprintBars(trade.symbol, FOOTPRINT_BARS_FOR_METRICS);
        if (activeTradeFootprintBars.length >= MIN_FOOTPRINT_BARS_FOR_ACTION) {
            const activeTradeMetrics = await calculateAllBotMetrics(activeTradeFootprintBars, getCurrentAggregatingBar(trade.symbol));
            const isBearishBarCharacterForExit = activeTradeMetrics.latestBarCharacter === "Price Sell" || activeTradeMetrics.latestBarCharacter === "Delta Sell";
            
            let priceNearVah = false;
            const vah = activeTradeMetrics.sessionVah;
            if (vah !== null) {
                const vahThresholdLower = vah * (1 - 0.002);
                priceNearVah = (currentPriceForTrade >= vahThresholdLower && currentPriceForTrade <= vah) || (getCurrentAggregatingBar(trade.symbol)?.high ?? 0) >= vah;
            }

            let proactiveExitReason = "";
            if (priceNearVah && isBearishBarCharacterForExit) {
                proactiveExitReason = "Price near VAH & Bearish Bar Character";
            } else if (activeTradeMetrics.imbalanceReversalSignal === 'BEARISH_IMBALANCE_REVERSAL') {
                proactiveExitReason = "Bearish Imbalance Reversal Detected";
            }

            if (proactiveExitReason && (trade.status === 'ACTIVE_LONG_ENTRY' || trade.status === 'ACTIVE_TRAILING_LONG')) {
                const exitPrice = currentPriceForTrade;
                const pnlValue = (exitPrice - trade.entryPrice) * trade.quantity;
                const pnlPercentageValue = (trade.entryPrice * trade.quantity === 0) ? 0 : (pnlValue / (trade.entryPrice * trade.quantity)) * 100;
                console.log(`[${botRunTimestamp}] Bot (User ${userId}): LONG PROACTIVE EXIT SIGNAL for ${trade.symbol} ID ${trade.id}. Reason: ${proactiveExitReason}.`);
                try {
                  await tradeService.updateTrade(userId, trade.id, { status: 'CLOSED_EXITED', exitPrice, pnl: pnlValue, pnlPercentage: pnlPercentageValue });
                  continue; 
                } catch (error) {
                  console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error closing LONG trade ${trade.id} via proactive exit:`, error);
                  await tradeService.updateTrade(userId, trade.id, { status: 'CLOSED_ERROR', sellError: error instanceof Error ? error.message : String(error) });
                  continue;
                }
            }
        }
        
        // Trailing Stop Logic for Long
        const profitPercentage = ((currentPriceForTrade - trade.entryPrice) / trade.entryPrice) * 100;
        if (trade.status === 'ACTIVE_LONG_ENTRY' && profitPercentage >= trailActivationProfitToUse) {
          try {
            await tradeService.updateTrade(userId, trade.id, { status: 'ACTIVE_TRAILING_LONG', trailingHighPrice: currentPriceForTrade });
            console.log(`[${botRunTimestamp}] Bot (User ${userId}): Trade ${trade.symbol} (ID: ${trade.id}) ACTIVATED LONG TRAILING STOP.`);
          } catch (error) {
            console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error updating LONG trade ${trade.id} to TRAILING:`, error);
          }
        } else if (trade.status === 'ACTIVE_TRAILING_LONG') {
            const highPrice = Math.max(trade.trailingHighPrice || 0, currentPriceForTrade);
            if (highPrice > (trade.trailingHighPrice || 0)) {
                await tradeService.updateTrade(userId, trade.id, { trailingHighPrice: highPrice });
            }
            const trailStopPrice = highPrice * (1 - trailDeltaToUse / 100);
            if (currentPriceForTrade <= trailStopPrice) {
                const exitPrice = currentPriceForTrade;
                const pnlValue = (exitPrice - trade.entryPrice) * trade.quantity;
                const pnlPercentageValue = (trade.entryPrice * trade.quantity === 0) ? 0 : (pnlValue / (trade.entryPrice * trade.quantity)) * 100;
                try {
                  await tradeService.updateTrade(userId, trade.id, { status: 'CLOSED_EXITED', exitPrice, pnl: pnlValue, pnlPercentage: pnlPercentageValue });
                } catch (error) {
                  console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error closing LONG trade ${trade.id} via trailing stop:`, error);
                  await tradeService.updateTrade(userId, trade.id, { status: 'CLOSED_ERROR', sellError: error instanceof Error ? error.message : String(error) });
                }
            }
        }
    } 
    // --- SHORT TRADE MANAGEMENT ---
    else if (trade.tradeDirection === 'SHORT') {
        // Initial SL Check for Short
        if (trade.status === 'ACTIVE_SHORT_ENTRY' && trade.initialStopLossPrice && currentPriceForTrade >= trade.initialStopLossPrice) {
            const exitPrice = trade.initialStopLossPrice;
            const pnlValue = (trade.entryPrice - exitPrice) * trade.quantity;
            const pnlPercentageValue = (trade.entryPrice * trade.quantity === 0) ? 0 : (pnlValue / (trade.entryPrice * trade.quantity)) * 100;
            
            console.log(`[${botRunTimestamp}] Bot (User ${userId}): SHORT INITIAL STOP-LOSS HIT for ${trade.symbol} ID ${trade.id}. Covering at $${exitPrice.toFixed(4)}.`);
            try {
              await tradeService.updateTrade(userId, trade.id, { status: 'CLOSED_EXITED', exitPrice, pnl: pnlValue, pnlPercentage: pnlPercentageValue });
            } catch (error) {
              console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error closing SHORT trade ${trade.id} via initial SL:`, error);
              await tradeService.updateTrade(userId, trade.id, { status: 'CLOSED_ERROR', sellError: error instanceof Error ? error.message : String(error) });
            }
            continue;
        }

        // Proactive Exit Logic for Short
        const activeTradeFootprintBars = getLatestFootprintBars(trade.symbol, FOOTPRINT_BARS_FOR_METRICS);
        if (activeTradeFootprintBars.length >= MIN_FOOTPRINT_BARS_FOR_ACTION) {
            const activeTradeMetrics = await calculateAllBotMetrics(activeTradeFootprintBars, getCurrentAggregatingBar(trade.symbol));
            const isBullishBarCharacterForExit = activeTradeMetrics.latestBarCharacter === "Price Buy" || activeTradeMetrics.latestBarCharacter === "Delta Buy";
            
            let priceNearVal = false;
            const val = activeTradeMetrics.sessionVal;
            if (val !== null) {
                const valThresholdUpper = val * (1 + 0.002);
                priceNearVal = (currentPriceForTrade >= val && currentPriceForTrade <= valThresholdUpper) || (getCurrentAggregatingBar(trade.symbol)?.low ?? Infinity) <= val;
            }

            let proactiveExitReason = "";
            if (priceNearVal && isBullishBarCharacterForExit) {
                proactiveExitReason = "Price near VAL & Bullish Bar Character";
            } else if (activeTradeMetrics.imbalanceReversalSignal === 'BULLISH_IMBALANCE_REVERSAL') {
                proactiveExitReason = "Bullish Imbalance Reversal Detected";
            }

            if (proactiveExitReason && (trade.status === 'ACTIVE_SHORT_ENTRY' || trade.status === 'ACTIVE_TRAILING_SHORT')) {
                const exitPrice = currentPriceForTrade;
                const pnlValue = (trade.entryPrice - exitPrice) * trade.quantity;
                const pnlPercentageValue = (trade.entryPrice * trade.quantity === 0) ? 0 : (pnlValue / (trade.entryPrice * trade.quantity)) * 100;
                console.log(`[${botRunTimestamp}] Bot (User ${userId}): SHORT PROACTIVE EXIT SIGNAL for ${trade.symbol} ID ${trade.id}. Reason: ${proactiveExitReason}.`);
                try {
                  await tradeService.updateTrade(userId, trade.id, { status: 'CLOSED_EXITED', exitPrice, pnl: pnlValue, pnlPercentage: pnlPercentageValue });
                  continue; 
                } catch (error) {
                  console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error closing SHORT trade ${trade.id} via proactive exit:`, error);
                  await tradeService.updateTrade(userId, trade.id, { status: 'CLOSED_ERROR', sellError: error instanceof Error ? error.message : String(error) });
                  continue;
                }
            }
        }

        // Trailing Stop Logic for Short
        const profitPercentage = ((trade.entryPrice - currentPriceForTrade) / trade.entryPrice) * 100;
        if (trade.status === 'ACTIVE_SHORT_ENTRY' && profitPercentage >= trailActivationProfitToUse) {
          try {
            await tradeService.updateTrade(userId, trade.id, { status: 'ACTIVE_TRAILING_SHORT', trailingLowPrice: currentPriceForTrade });
            console.log(`[${botRunTimestamp}] Bot (User ${userId}): Trade ${trade.symbol} (ID: ${trade.id}) ACTIVATED SHORT TRAILING STOP.`);
          } catch (error) {
            console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error updating SHORT trade ${trade.id} to TRAILING:`, error);
          }
        } else if (trade.status === 'ACTIVE_TRAILING_SHORT') {
            const lowPrice = Math.min(trade.trailingLowPrice || Infinity, currentPriceForTrade);
            if (lowPrice < (trade.trailingLowPrice || Infinity)) {
                await tradeService.updateTrade(userId, trade.id, { trailingLowPrice: lowPrice });
            }
            const trailStopPrice = lowPrice * (1 + trailDeltaToUse / 100);
            if (currentPriceForTrade >= trailStopPrice) {
                const exitPrice = currentPriceForTrade;
                const pnlValue = (trade.entryPrice - exitPrice) * trade.quantity;
                const pnlPercentageValue = (trade.entryPrice * trade.quantity === 0) ? 0 : (pnlValue / (trade.entryPrice * trade.quantity)) * 100;
                try {
                  await tradeService.updateTrade(userId, trade.id, { status: 'CLOSED_EXITED', exitPrice, pnl: pnlValue, pnlPercentage: pnlPercentageValue });
                } catch (error) {
                  console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error closing SHORT trade ${trade.id} via trailing stop:`, error);
                  await tradeService.updateTrade(userId, trade.id, { status: 'CLOSED_ERROR', sellError: error instanceof Error ? error.message : String(error) });
                }
            }
        }
    }
  }
  console.log(`[${botRunTimestamp}] Bot cycle ENDED for user ${userId}.`);
}
