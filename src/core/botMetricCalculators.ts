
'use server';
/**
 * @fileOverview Server-side calculators for order flow metrics for the trading bot.
 */
import type { FootprintBar, PriceLevelData } from '@/types/footprint';

const VALUE_AREA_PERCENTAGE = 0.7; // 70% for VAH/VAL calculation
const MIN_BARS_FOR_DIVERGENCE_CALC = 10;
const SWING_LOOKAROUND_WINDOW_CALC = 2;

interface SessionProfileMetricsBot {
  sessionPocPrice: number | null;
  sessionPocVolume: number | null;
  vah: number | null;
  val: number | null;
}

export async function calculateSessionVolumeProfileAndVAForBot(bars: FootprintBar[]): Promise<SessionProfileMetricsBot> {
  const emptyMetrics: SessionProfileMetricsBot = {
    sessionPocPrice: null, sessionPocVolume: null, vah: null, val: null,
  };

  if (!bars || bars.length === 0) {
    return emptyMetrics;
  }

  const sessionProfileMap = new Map<number, number>(); // price (number) -> total volume
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

  if (totalSessionVolume === 0 || sessionProfileMap.size === 0) {
    return emptyMetrics;
  }

  const sortedProfile = Array.from(sessionProfileMap.entries())
    .map(([price, volume]) => ({ price, volume }))
    .sort((a, b) => b.price - a.price); // Sort by price descending (high to low)

  let sessionPocPriceNum: number | null = null;
  let sessionPocVolume = 0;
  sortedProfile.forEach(level => {
    if (level.volume > sessionPocVolume) {
      sessionPocVolume = level.volume;
      sessionPocPriceNum = level.price;
    }
  });

  if (sessionPocPriceNum === null) {
    return emptyMetrics;
  }

  const targetVolumeForVA = totalSessionVolume * VALUE_AREA_PERCENTAGE;
  let volumeInVA = 0;
  let vahNum: number | null = sessionPocPriceNum;
  let valNum: number | null = sessionPocPriceNum;

  const pocIndex = sortedProfile.findIndex(p => p.price === sessionPocPriceNum);
  if (pocIndex === -1) {
     return { ...emptyMetrics, sessionPocPrice: sessionPocPriceNum, sessionPocVolume };
  }

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
    } else if (volBelow >= volAbove) {
      volumeInVA += volBelow;
      valNum = sortedProfile[bottomPointer].price;
      bottomPointer++;
    } else {
        if (volBelow !== -1) {
            volumeInVA += volBelow;
            valNum = sortedProfile[bottomPointer].price;
            bottomPointer++;
        } else {
            break;
        }
    }
  }

  return {
    sessionPocPrice: sessionPocPriceNum,
    sessionPocVolume: sessionPocVolume,
    vah: vahNum,
    val: valNum,
  };
}


interface BarCharacterResult {
    character: string;
    // Future: Add confidence or other details if needed
}

export async function getBarCharacterForBot(bar: Partial<FootprintBar> | null | undefined): Promise<BarCharacterResult> {
    if (!bar || bar.open === undefined || bar.close === undefined || bar.delta === undefined || bar.delta === null) {
        return { character: "N/A" };
    }

    if (bar.close > bar.open && bar.delta >= 0) return { character: "Price Buy" };
    if (bar.close < bar.open && bar.delta <= 0) return { character: "Price Sell" };
    // These need to be after the combined conditions to ensure correct categorization
    if (bar.delta < 0) return { character: "Delta Sell" }; // Price might be up or down, but delta is selling
    if (bar.delta > 0) return { character: "Delta Buy" };  // Price might be up or down, but delta is buying
    
    return { character: "Neutral" };
}


interface SwingPointBot {
  price: number;
  cd: number;
  barTimestamp: number;
}

export async function calculateDivergencesForBot(completedBars: FootprintBar[]): Promise<string[]> {
  if (completedBars.length < MIN_BARS_FOR_DIVERGENCE_CALC) {
    return [];
  }

  const chronologicalBars = [...completedBars].sort((a,b) => a.timestamp - b.timestamp); // oldest to newest
  let currentCD = 0;
  const barsWithCD = chronologicalBars.map(bar => {
    currentCD += bar.delta || 0;
    return { ...bar, cumulativeDelta: currentCD };
  });

  const divergenceSignals: string[] = [];
  const swingHighs: SwingPointBot[] = [];
  const swingLows: SwingPointBot[] = [];

  for (let i = SWING_LOOKAROUND_WINDOW_CALC; i < barsWithCD.length - SWING_LOOKAROUND_WINDOW_CALC; i++) {
    const currentBar = barsWithCD[i];
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= SWING_LOOKAROUND_WINDOW_CALC; j++) {
      if (barsWithCD[i-j].high > currentBar.high || barsWithCD[i+j].high > currentBar.high) {
        isSwingHigh = false;
      }
      if (barsWithCD[i-j].low < currentBar.low || barsWithCD[i+j].low < currentBar.low) {
        isSwingLow = false;
      }
    }

    if (isSwingHigh) {
      swingHighs.push({ price: currentBar.high, cd: currentBar.cumulativeDelta, barTimestamp: currentBar.timestamp });
    }
    if (isSwingLow) {
      swingLows.push({ price: currentBar.low, cd: currentBar.cumulativeDelta, barTimestamp: currentBar.timestamp });
    }
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

export async function calculateSessionVwapForBot(bars: FootprintBar[]): Promise<number | null> {
    if (!bars || bars.length === 0) {
        return null;
    }

    let cumulativeTypicalPriceVolume = 0;
    let cumulativeVolume = 0;

    // Chronological order is important for VWAP
    const chronologicalBars = [...bars].sort((a, b) => a.timestamp - b.timestamp);

    for (const bar of chronologicalBars) {
        if (bar.totalVolume > 0) {
            const typicalPrice = (bar.high + bar.low + bar.close) / 3;
            cumulativeTypicalPriceVolume += typicalPrice * bar.totalVolume;
            cumulativeVolume += bar.totalVolume;
        }
    }

    if (cumulativeVolume === 0) {
        return null;
    }

    return cumulativeTypicalPriceVolume / cumulativeVolume;
}

export interface BotOrderFlowMetrics {
    sessionPoc: number | null;
    sessionVah: number | null;
    sessionVal: number | null;
    sessionVwap: number | null;
    latestBarCharacter: string;
    divergenceSignals: string[];
}

export async function calculateAllBotMetrics(
    completedFootprintBars: FootprintBar[],
    currentAggregatingBar: Partial<FootprintBar> | undefined
) : Promise<BotOrderFlowMetrics> {

    const sessionMetrics = await calculateSessionVolumeProfileAndVAForBot(completedFootprintBars);
    const sessionVwap = await calculateSessionVwapForBot(completedFootprintBars);
    
    let barForCharacterAnalysis: Partial<FootprintBar> | undefined = currentAggregatingBar;
    if (!barForCharacterAnalysis || (barForCharacterAnalysis.totalVolume === 0 || barForCharacterAnalysis.totalVolume === undefined)) {
        if(completedFootprintBars.length > 0) {
            // Use the latest completed bar if current aggregating is empty
            barForCharacterAnalysis = completedFootprintBars[completedFootprintBars.length - 1];
        }
    }
    const barCharacterResult = await getBarCharacterForBot(barForCharacterAnalysis);
    const divergenceSignals = await calculateDivergencesForBot(completedFootprintBars);

    return {
        sessionPoc: sessionMetrics.sessionPocPrice,
        sessionVah: sessionMetrics.vah,
        sessionVal: sessionMetrics.val,
        sessionVwap: sessionVwap,
        latestBarCharacter: barCharacterResult.character,
        divergenceSignals: divergenceSignals
    };
}
