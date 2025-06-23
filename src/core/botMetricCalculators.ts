
'use server';
/**
 * @fileOverview Server-side calculators for order flow metrics for the trading bot.
 */
import type { FootprintBar, PriceLevelData } from '@/types/footprint';
import type { SettingsFormValues } from '@/components/settings/settings-form';

type BotCalculationParameters = Pick<SettingsFormValues, 
  'valueAreaPercentage' | 
  'imbalanceRatioThreshold' | 
  'stackedImbalanceCount' | 
  'swingLookaroundWindow' | 
  'minBarsForDivergence'
>;

interface SessionProfileMetricsBot {
  sessionPocPrice: number | null;
  sessionPocVolume: number | null;
  vah: number | null;
  val: number | null;
}

async function calculateSessionVolumeProfileAndVAForBot(bars: FootprintBar[], params: BotCalculationParameters): Promise<SessionProfileMetricsBot> {
  const emptyMetrics: SessionProfileMetricsBot = { sessionPocPrice: null, sessionPocVolume: null, vah: null, val: null };
  if (!bars || bars.length === 0) return emptyMetrics;

  const sessionProfileMap = new Map<number, number>();
  let totalSessionVolume = 0;

  bars.forEach(bar => {
    if (bar.priceLevels) {
      bar.priceLevels.forEach((levelData, priceStr) => {
        const priceNum = parseFloat(priceStr);
        if (isNaN(priceNum)) return;
        const volumeAtLevel = (levelData.buyVolume || 0) + (levelData.sellVolume || 0);
        sessionProfileMap.set(priceNum, (sessionProfileMap.get(priceNum) || 0) + volumeAtLevel);
        totalSessionVolume += volumeAtLevel;
      });
    }
  });

  if (totalSessionVolume === 0 || sessionProfileMap.size === 0) return emptyMetrics;

  const sortedProfile = Array.from(sessionProfileMap.entries())
    .map(([price, volume]) => ({ price, volume }))
    .sort((a, b) => b.price - a.price);

  let sessionPocPriceNum: number | null = null;
  let sessionPocVolume = 0;
  sortedProfile.forEach(level => {
    if (level.volume > sessionPocVolume) {
      sessionPocVolume = level.volume;
      sessionPocPriceNum = level.price;
    }
  });

  if (sessionPocPriceNum === null) return emptyMetrics;

  const targetVolumeForVA = totalSessionVolume * (params.valueAreaPercentage / 100);
  let volumeInVA = 0;
  let vahNum: number | null = sessionPocPriceNum;
  let valNum: number | null = sessionPocPriceNum;

  const pocIndex = sortedProfile.findIndex(p => p.price === sessionPocPriceNum);
  if (pocIndex === -1) return { ...emptyMetrics, sessionPocPrice: sessionPocPriceNum, sessionPocVolume };

  volumeInVA = sortedProfile[pocIndex].volume;
  let topPointer = pocIndex - 1;
  let bottomPointer = pocIndex + 1;

  while (volumeInVA < targetVolumeForVA) {
    const volAbove = topPointer >= 0 ? sortedProfile[topPointer].volume : -1;
    const volBelow = bottomPointer < sortedProfile.length ? sortedProfile[bottomPointer].volume : -1;

    if (volAbove === -1 && volBelow === -1) break;

    if (volAbove > volBelow) {
      volumeInVA += volAbove;
      vahNum = sortedProfile[topPointer].price;
      topPointer--;
    } else {
      volumeInVA += volBelow;
      valNum = sortedProfile[bottomPointer].price;
      bottomPointer++;
    }
  }

  return { sessionPocPrice: sessionPocPriceNum, sessionPocVolume, vah: vahNum, val: valNum };
}

interface BarCharacterResult {
    character: string;
}

async function getBarCharacterForBot(bar: Partial<FootprintBar> | null | undefined): Promise<BarCharacterResult> {
    if (!bar || bar.open === undefined || bar.close === undefined || bar.delta === undefined || bar.delta === null) {
        return { character: "N/A" };
    }
    if (bar.close > bar.open && bar.delta >= 0) return { character: "Price Buy" };
    if (bar.close < bar.open && bar.delta <= 0) return { character: "Price Sell" };
    if (bar.delta < 0) return { character: "Delta Sell" };
    if (bar.delta > 0) return { character: "Delta Buy" };  
    return { character: "Neutral" };
}

interface SwingPointBot {
  price: number;
  cd: number;
  barTimestamp: number;
}

async function calculateDivergencesForBot(completedBars: FootprintBar[], params: BotCalculationParameters): Promise<string[]> {
  if (completedBars.length < params.minBarsForDivergence) return [];

  const chronologicalBars = [...completedBars].sort((a,b) => a.timestamp - b.timestamp);
  let currentCD = 0;
  const barsWithCD = chronologicalBars.map(bar => {
    currentCD += bar.delta || 0;
    return { ...bar, cumulativeDelta: currentCD };
  });

  const divergenceSignals: string[] = [];
  const swingHighs: SwingPointBot[] = [];
  const swingLows: SwingPointBot[] = [];

  for (let i = params.swingLookaroundWindow; i < barsWithCD.length - params.swingLookaroundWindow; i++) {
    const currentBar = barsWithCD[i];
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= params.swingLookaroundWindow; j++) {
      if (barsWithCD[i-j].high > currentBar.high || barsWithCD[i+j].high > currentBar.high) isSwingHigh = false;
      if (barsWithCD[i-j].low < currentBar.low || barsWithCD[i+j].low < currentBar.low) isSwingLow = false;
    }

    if (isSwingHigh) swingHighs.push({ price: currentBar.high, cd: currentBar.cumulativeDelta, barTimestamp: currentBar.timestamp });
    if (isSwingLow) swingLows.push({ price: currentBar.low, cd: currentBar.cumulativeDelta, barTimestamp: currentBar.timestamp });
  }

  const recentSwingHighs = swingHighs.slice(-2);
  const recentSwingLows = swingLows.slice(-2);

  if (recentSwingHighs.length >= 2) {
    const lastSwingHigh = recentSwingHighs[1];
    const prevSwingHigh = recentSwingHighs[0];
    if (lastSwingHigh.barTimestamp > prevSwingHigh.barTimestamp && lastSwingHigh.price > prevSwingHigh.price && lastSwingHigh.cd <= prevSwingHigh.cd) {
      divergenceSignals.push("Bearish Delta Divergence");
    }
  }

  if (recentSwingLows.length >= 2) {
    const lastSwingLow = recentSwingLows[1];
    const prevSwingLow = recentSwingLows[0];
     if (lastSwingLow.barTimestamp > prevSwingLow.barTimestamp && lastSwingLow.price < prevSwingLow.price && lastSwingLow.cd >= prevSwingLow.cd) {
      divergenceSignals.push("Bullish Delta Divergence");
    }
  }
  return divergenceSignals;
}

async function calculateSessionVwapForBot(bars: FootprintBar[]): Promise<number | null> {
    if (!bars || bars.length === 0) return null;
    let cumulativeTypicalPriceVolume = 0;
    let cumulativeVolume = 0;
    const chronologicalBars = [...bars].sort((a, b) => a.timestamp - b.timestamp);
    for (const bar of chronologicalBars) {
        if (bar.totalVolume > 0) {
            const typicalPrice = (bar.high + bar.low + bar.close) / 3;
            cumulativeTypicalPriceVolume += typicalPrice * bar.totalVolume;
            cumulativeVolume += bar.totalVolume;
        }
    }
    return cumulativeVolume === 0 ? null : cumulativeTypicalPriceVolume / cumulativeVolume;
}

async function detectImbalanceReversal(completedBars: FootprintBar[], params: BotCalculationParameters): Promise<string | null> {
    if (completedBars.length < 2) return null;

    const n_minus_1_bar = completedBars[completedBars.length - 2];
    const last_bar = completedBars[completedBars.length - 1];

    if (!n_minus_1_bar.priceLevels || n_minus_1_bar.priceLevels.size === 0) return null;
    
    const sortedLevels = Array.from(n_minus_1_bar.priceLevels.entries())
      .map(([priceStr, levelData]) => ({
        price: parseFloat(priceStr),
        buyVolume: levelData.buyVolume || 0,
        sellVolume: levelData.sellVolume || 0,
      }))
      .sort((a, b) => b.price - a.price);

    let stackedBuyImbalances = 0;
    for (let i = 0; i < sortedLevels.length - 1; i++) {
        const currentLevel = sortedLevels[i];
        const levelBelow = sortedLevels[i + 1];
        if (currentLevel.buyVolume >= (levelBelow.sellVolume * params.imbalanceRatioThreshold) && levelBelow.sellVolume > 0) {
            stackedBuyImbalances++;
            if (stackedBuyImbalances >= params.stackedImbalanceCount && currentLevel.price >= n_minus_1_bar.high) {
                if (last_bar.close < last_bar.open) return 'BEARISH_IMBALANCE_REVERSAL';
            }
        } else {
            stackedBuyImbalances = 0;
        }
    }

    let stackedSellImbalances = 0;
    for (let i = sortedLevels.length - 1; i > 0; i--) {
        const currentLevel = sortedLevels[i];
        const levelAbove = sortedLevels[i - 1];
        if (currentLevel.sellVolume >= (levelAbove.buyVolume * params.imbalanceRatioThreshold) && levelAbove.buyVolume > 0) {
            stackedSellImbalances++;
            if (stackedSellImbalances >= params.stackedImbalanceCount && currentLevel.price <= n_minus_1_bar.low) {
                if (last_bar.close > last_bar.open) return 'BULLISH_IMBALANCE_REVERSAL';
            }
        } else {
            stackedSellImbalances = 0;
        }
    }

    return null;
}

export interface BotOrderFlowMetrics {
    sessionPoc: number | null;
    sessionVah: number | null;
    sessionVal: number | null;
    sessionVwap: number | null;
    latestBarCharacter: string;
    divergenceSignals: string[];
    imbalanceReversalSignal: string | null;
}

export async function calculateAllBotMetrics(
    completedFootprintBars: FootprintBar[],
    currentAggregatingBar: Partial<FootprintBar> | undefined,
    params: BotCalculationParameters
) : Promise<BotOrderFlowMetrics> {

    const sessionMetrics = await calculateSessionVolumeProfileAndVAForBot(completedFootprintBars, params);
    const sessionVwap = await calculateSessionVwapForBot(completedFootprintBars);
    
    let barForCharacterAnalysis: Partial<FootprintBar> | undefined = currentAggregatingBar;
    if (!barForCharacterAnalysis || (barForCharacterAnalysis.totalVolume === 0 || barForCharacterAnalysis.totalVolume === undefined)) {
        if(completedFootprintBars.length > 0) {
            barForCharacterAnalysis = completedFootprintBars[completedFootprintBars.length - 1];
        }
    }
    const barCharacterResult = await getBarCharacterForBot(barForCharacterAnalysis);
    const divergenceSignals = await calculateDivergencesForBot(completedFootprintBars, params);
    const imbalanceReversalSignal = await detectImbalanceReversal(completedFootprintBars, params);

    return {
        sessionPoc: sessionMetrics.sessionPocPrice,
        sessionVah: sessionMetrics.vah,
        sessionVal: sessionMetrics.val,
        sessionVwap: sessionVwap,
        latestBarCharacter: barCharacterResult.character,
        divergenceSignals: divergenceSignals,
        imbalanceReversalSignal: imbalanceReversalSignal
    };
}
