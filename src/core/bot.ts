
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
const MIN_FOOTPRINT_BARS_FOR_ACTION = 5; 
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

  const buyAmountUsdToUse = typeof userSettings.buyAmountUsd === 'number' && userSettings.buyAmountUsd > 0 ? userSettings.buyAmountUsd : defaultSettingsValues.buyAmountUsd;
  const trailActivationProfitToUse = typeof userSettings.trailActivationProfit === 'number' && userSettings.trailActivationProfit > 0 ? userSettings.trailActivationProfit : defaultSettingsValues.trailActivationProfit;
  const trailDeltaToUse = typeof userSettings.trailDelta === 'number' && userSettings.trailDelta > 0 ? userSettings.trailDelta : defaultSettingsValues.trailDelta;
  // const dipPercentageToUse = typeof userSettings.dipPercentage === 'number' ? userSettings.dipPercentage : defaultSettingsValues.dipPercentage;


  console.log(`[${botRunTimestamp}] Bot cycle STARTED for user ${userId}. Strategy (General Params): BuyAmt: $${buyAmountUsdToUse}, TrailProfit: ${trailActivationProfitToUse}%, TrailDelta: ${trailDeltaToUse}%, InitStopLoss: ${INITIAL_STOP_LOSS_PERCENTAGE}%`);

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

  console.log(`[${botRunTimestamp}] Bot (User ${userId}): Analyzing ${MONITORED_MARKET_SYMBOLS.length} monitored symbols for new entries.`);

  for (const symbol of MONITORED_MARKET_SYMBOLS) {
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
      // console.log(`[${botRunTimestamp}] Bot (User ${userId}) [${symbol}]: Not enough completed footprint bars (${completedFootprintBars.length}) for metric-based decisions. Min required: ${MIN_FOOTPRINT_BARS_FOR_ACTION}.`);
      continue;
    }
    
    const metrics: BotOrderFlowMetrics = await calculateAllBotMetrics(completedFootprintBars, currentAggregatingBar);
    const existingTradeForSymbol = activeTradeSymbols.includes(symbol);

    if (!existingTradeForSymbol) {
      let shouldBuy = false;
      let entryReason = "";
      const isBullishBarCharacter = metrics.latestBarCharacter === "Price Buy" || metrics.latestBarCharacter === "Delta Buy";
      
      const val = metrics.sessionVal;
      let priceNearVal = false;
      if (val !== null) {
        const valThresholdUpper = val * (1 + 0.002); // VAL + 0.2%
        priceNearVal = (currentPrice >= val && currentPrice <= valThresholdUpper);
        if (!priceNearVal && currentAggregatingBar?.low) priceNearVal = currentAggregatingBar.low <= val;
        if (!priceNearVal && completedFootprintBars.length > 0) {
            const lastCompletedBar = completedFootprintBars[completedFootprintBars.length -1]; 
            if(lastCompletedBar.low <= val) priceNearVal = true;
        }
      }

      if (priceNearVal && isBullishBarCharacter) {
        shouldBuy = true;
        entryReason = `Price near VAL (${val?.toFixed(4)}) & Bullish Bar Character ('${metrics.latestBarCharacter}')`;
      }

      if (!shouldBuy && metrics.divergenceSignals.includes("Bullish Delta Divergence") && isBullishBarCharacter) {
        shouldBuy = true;
        entryReason = `Bullish Delta Divergence & Bullish Bar Character ('${metrics.latestBarCharacter}')`;
      }

      if (shouldBuy) {
           const entryPrice = currentPrice;
           const initialStopLossPrice = entryPrice * (1 - INITIAL_STOP_LOSS_PERCENTAGE / 100);
           console.log(`[${botRunTimestamp}] Bot (User ${userId}): METRICS-BASED BUY SIGNAL for ${symbol} at ${entryPrice.toFixed(4)}. Reason: ${entryReason}. Amount: $${buyAmountUsdToUse}. Initial SL: $${initialStopLossPrice.toFixed(4)}`);
           const quantityToBuy = buyAmountUsdToUse / entryPrice;
           const { baseAsset, quoteAsset } = getAssetsFromSymbol(symbol);
           try {
             await tradeService.createTrade({
               userId: userId,
               symbol: symbol,
               baseAsset,
               quoteAsset,
               buyPrice: entryPrice,
               quantity: quantityToBuy,
               initialStopLossPrice: initialStopLossPrice,
             });
             console.log(`[${botRunTimestamp}] Bot (User ${userId}): DB TRADE RECORD CREATED for BUY of ${quantityToBuy.toFixed(6)} ${baseAsset} (${symbol}) at $${entryPrice.toFixed(4)}.`);
             activeTradeSymbols.push(symbol); 
           } catch (error) {
             console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error creating trade record for ${symbol}:`, error);
           }
      }
    }
  }

  const currentActiveTradesForManagement = await tradeService.getActiveTrades(userId);
  if (currentActiveTradesForManagement.length > 0) {
      console.log(`[${botRunTimestamp}] Bot (User ${userId}): Managing ${currentActiveTradesForManagement.length} active bot trades for exits/trailing...`);
  }

  for (const trade of currentActiveTradesForManagement) {
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

    // --- Initial Stop-Loss Check (for ACTIVE_BOUGHT trades only) ---
    if (trade.status === 'ACTIVE_BOUGHT' && trade.initialStopLossPrice && currentPriceForTrade <= trade.initialStopLossPrice) {
        const sellPrice = trade.initialStopLossPrice; // Or currentPriceForTrade if simulating slippage beyond SL
        const pnlValue = (sellPrice - trade.buyPrice) * trade.quantity;
        const pnlPercentageValue = (trade.buyPrice * trade.quantity === 0) ? 0 : (pnlValue / (trade.buyPrice * trade.quantity)) * 100;
        
        console.log(`[${botRunTimestamp}] Bot (User ${userId}): INITIAL STOP-LOSS HIT for ${trade.symbol} ID ${trade.id} at $${currentPriceForTrade.toFixed(4)} (SL: $${trade.initialStopLossPrice.toFixed(4)}). Selling at $${sellPrice.toFixed(4)}.`);
        try {
          await tradeService.updateTrade(userId, trade.id, {
            status: 'CLOSED_SOLD',
            sellPrice: sellPrice,
            sellTimestamp: Date.now(),
            pnl: pnlValue,
            pnlPercentage: pnlPercentageValue,
          });
          console.log(`[${botRunTimestamp}] Bot (User ${userId}): SOLD (Initial SL) ${trade.quantity.toFixed(6)} ${trade.baseAsset} (${trade.symbol}) ID ${trade.id}. P&L: $${pnlValue.toFixed(2)} (${pnlPercentageValue.toFixed(2)}%).`);
        } catch (error) {
          console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error closing trade ${trade.id} via initial stop-loss:`, error);
          try {
            await tradeService.updateTrade(userId, trade.id, { status: 'CLOSED_ERROR', sellError: error instanceof Error ? error.message : String(error) });
          } catch (dbError) {
            console.error(`[${botRunTimestamp}] Bot (User ${userId}): CRITICAL - Failed to mark trade ${trade.id} as error after initial SL sell failure:`, dbError);
          }
        }
        continue; // Trade closed, move to next active trade
    }


    // --- Proactive Exit Logic (if not stopped by initial SL) ---
    const activeTradeFootprintBars = getLatestFootprintBars(trade.symbol, FOOTPRINT_BARS_FOR_METRICS);
    const activeTradeAggregatingBar = getCurrentAggregatingBar(trade.symbol);

    let proactiveExitTriggered = false;
    if (activeTradeFootprintBars.length >= MIN_FOOTPRINT_BARS_FOR_ACTION) {
        const activeTradeMetrics = await calculateAllBotMetrics(activeTradeFootprintBars, activeTradeAggregatingBar);
        const isBearishBarCharacterForExit = activeTradeMetrics.latestBarCharacter === "Price Sell" || activeTradeMetrics.latestBarCharacter === "Delta Sell";
        
        let priceNearVah = false;
        const vah = activeTradeMetrics.sessionVah;
        if (vah !== null) {
            const vahThresholdLower = vah * (1 - 0.002); // VAH - 0.2%
            priceNearVah = (currentPriceForTrade >= vahThresholdLower && currentPriceForTrade <= vah);
            if (!priceNearVah && activeTradeAggregatingBar?.high) priceNearVah = activeTradeAggregatingBar.high >= vah;
            if (!priceNearVah && activeTradeFootprintBars.length > 0) {
                const lastCompleted = activeTradeFootprintBars[activeTradeFootprintBars.length - 1]; 
                if (lastCompleted.high >= vah) priceNearVah = true;
            }
        }

        if (priceNearVah && isBearishBarCharacterForExit && (trade.status === 'ACTIVE_BOUGHT' || trade.status === 'ACTIVE_TRAILING')) {
            const sellPrice = currentPriceForTrade;
            const pnlValue = (sellPrice - trade.buyPrice) * trade.quantity;
            const pnlPercentageValue = (trade.buyPrice * trade.quantity === 0) ? 0 : (pnlValue / (trade.buyPrice * trade.quantity)) * 100;
            
            console.log(`[${botRunTimestamp}] Bot (User ${userId}): PROACTIVE EXIT SIGNAL for ${trade.symbol} ID ${trade.id} at $${sellPrice.toFixed(4)}. Reason: Price near VAH (${vah?.toFixed(4)}) & Bearish Bar Character ('${activeTradeMetrics.latestBarCharacter}')`);
            try {
              await tradeService.updateTrade(userId, trade.id, {
                status: 'CLOSED_SOLD',
                sellPrice: sellPrice,
                sellTimestamp: Date.now(),
                pnl: pnlValue,
                pnlPercentage: pnlPercentageValue,
              });
              console.log(`[${botRunTimestamp}] Bot (User ${userId}): SOLD (Proactive Exit) ${trade.quantity.toFixed(6)} ${trade.baseAsset} (${trade.symbol}) ID ${trade.id}. P&L: $${pnlValue.toFixed(2)} (${pnlPercentageValue.toFixed(2)}%).`);
              proactiveExitTriggered = true;
            } catch (error) {
              console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error closing trade ${trade.id} via proactive exit:`, error);
              try {
                await tradeService.updateTrade(userId, trade.id, { status: 'CLOSED_ERROR', sellError: error instanceof Error ? error.message : String(error) });
              } catch (dbError) {
                console.error(`[${botRunTimestamp}] Bot (User ${userId}): CRITICAL - Failed to mark trade ${trade.id} as error after proactive sell failure:`, dbError);
              }
              proactiveExitTriggered = true; // Still consider it handled to avoid trailing stop logic this cycle if error occurred
            }
        }
    }
    
    if (proactiveExitTriggered) {
        continue; // Trade was handled by proactive exit, move to next.
    }

    // --- Trailing Stop Logic (if not proactively exited and not hit by initial SL) ---
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
        } catch (error) {
            console.error(`[${botRunTimestamp}] Bot (User ${userId}): Error updating new trailingHighPrice for ${trade.id}:`, error);
        }
      }

      const trailStopPrice = newHighPrice * (1 - trailDeltaToUse / 100);
      if (currentPriceForTrade <= trailStopPrice) {
        const sellPrice = currentPriceForTrade; 
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
