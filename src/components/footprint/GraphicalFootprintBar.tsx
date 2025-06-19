
'use client';

import React, { useEffect, useState } from 'react';
import type { FootprintBar, PriceLevelData } from '@/types/footprint';
import { cn } from '@/lib/utils';

interface GraphicalFootprintBarProps {
  bar: Partial<FootprintBar>;
}

interface ProcessedPriceLevel {
  priceDisplay: string;
  priceValue: number;
  buyVolume: number;
  sellVolume: number;
  totalVolumeAtLevel: number;
  isPoc: boolean;
  buyImbalance?: boolean;
  sellImbalance?: boolean;
}

const IMBALANCE_RATIO = 3.0; // Configurable: e.g., 3 times larger

const GraphicalFootprintBar: React.FC<GraphicalFootprintBarProps> = ({ bar }) => {
  const [processedData, setProcessedData] = useState<ProcessedPriceLevel[]>([]);
  const [pocInfo, setPocInfo] = useState<{ priceDisplay: string; totalVolume: number } | null>(null);

  useEffect(() => {
    if (!bar || !bar.priceLevels) {
      setProcessedData([]);
      setPocInfo(null);
      return;
    }

    const priceLevelsMap = bar.priceLevels instanceof Map
      ? bar.priceLevels
      : new Map(Object.entries(bar.priceLevels as Record<string, PriceLevelData>));

    if (priceLevelsMap.size === 0) {
      setProcessedData([]);
      setPocInfo(null);
      return;
    }

    const sortedLevels: Omit<ProcessedPriceLevel, 'isPoc' | 'buyImbalance' | 'sellImbalance'>[] = Array.from(priceLevelsMap.entries())
      .map(([priceStr, levelData]) => {
        const price = parseFloat(priceStr);
        const sellVol = levelData.sellVolume || 0;
        const buyVol = levelData.buyVolume || 0;
        return {
          priceDisplay: price.toFixed(Math.max(2, price < 1 && price !== 0 ? 5 : 2)),
          priceValue: price,
          buyVolume: buyVol,
          sellVolume: sellVol,
          totalVolumeAtLevel: sellVol + buyVol,
        };
      })
      .sort((a, b) => b.priceValue - a.priceValue); // Sort descending by priceValue (highest price first)

    if (sortedLevels.length === 0) {
      setProcessedData([]);
      setPocInfo(null);
      return;
    }
    
    let maxVolume = -1;
    let currentPocDisplay: string | null = null;
    let currentPocTotalVolume = 0;

    sortedLevels.forEach(level => {
      if (level.totalVolumeAtLevel > maxVolume) {
        maxVolume = level.totalVolumeAtLevel;
        currentPocDisplay = level.priceDisplay;
        currentPocTotalVolume = maxVolume;
      }
    });
    
    if (currentPocDisplay) {
      setPocInfo({ priceDisplay: currentPocDisplay, totalVolume: currentPocTotalVolume });
    } else {
      setPocInfo(null);
    }

    // Calculate imbalances
    const finalProcessedData: ProcessedPriceLevel[] = sortedLevels.map((level, index, arr) => {
      let buyImbalance = false;
      let sellImbalance = false;

      // Check for Buy Imbalance (current level's buyVolume vs. sellVolume of level below)
      const levelBelow = arr[index + 1];
      if (levelBelow) {
        if (levelBelow.sellVolume === 0 && level.buyVolume > 0) {
          buyImbalance = true;
        } else if (levelBelow.sellVolume > 0 && level.buyVolume >= levelBelow.sellVolume * IMBALANCE_RATIO) {
          buyImbalance = true;
        }
      } else if (level.buyVolume > 0 && arr.length > 1) { 
        // If this is the lowest level and it has buy volume, it's an imbalance against a "zero" below.
        // Only consider if there's more than one level to avoid single-level "imbalances".
        buyImbalance = true;
      }


      // Check for Sell Imbalance (current level's sellVolume vs. buyVolume of level above)
      const levelAbove = arr[index - 1];
      if (levelAbove) {
        if (levelAbove.buyVolume === 0 && level.sellVolume > 0) {
          sellImbalance = true;
        } else if (levelAbove.buyVolume > 0 && level.sellVolume >= levelAbove.buyVolume * IMBALANCE_RATIO) {
          sellImbalance = true;
        }
      } else if (level.sellVolume > 0 && arr.length > 1) {
         // If this is the highest level and it has sell volume, it's an imbalance against a "zero" above.
        sellImbalance = true;
      }


      return {
        ...level,
        isPoc: level.priceDisplay === currentPocDisplay,
        buyImbalance,
        sellImbalance,
      };
    });
    
    setProcessedData(finalProcessedData);

  }, [bar]);


  const isMap = bar.priceLevels instanceof Map;
  const isPlainObject = typeof bar.priceLevels === 'object' && bar.priceLevels !== null && !isMap;
  let isEmpty = false;

  if (isMap) {
    if ((bar.priceLevels as Map<string, PriceLevelData>).size === 0) isEmpty = true;
  } else if (isPlainObject) {
    if (Object.keys(bar.priceLevels as Record<string, PriceLevelData>).length === 0) isEmpty = true;
  } else if (bar.priceLevels === undefined || bar.priceLevels === null) { // Handles case where priceLevels is not even an empty map/object
    isEmpty = true;
  }


  if (isEmpty && (bar.totalVolume === 0 || bar.totalVolume === undefined)) {
    return <p className="text-muted-foreground text-xs py-2 text-center italic">No trades or price level data for this bar.</p>;
  }
   if (processedData.length === 0 && (bar.totalVolume !== undefined && bar.totalVolume > 0)) {
     return <p className="text-muted-foreground text-xs py-2 text-center italic">Aggregating volume data...</p>;
   }
    if (processedData.length === 0) {
      return <p className="text-muted-foreground text-xs py-2 text-center italic">No price levels to display.</p>;
    }


  return (
    <div className="mt-2 w-full font-mono text-xs tabular-nums">
      <div className="flex justify-between items-center px-1 py-0.5 bg-muted/50 rounded-t-md border-b border-border">
        <span className="w-1/3 text-center font-semibold">Sell Vol</span>
        <span className="w-1/3 text-center font-semibold">Price</span>
        <span className="w-1/3 text-center font-semibold">Buy Vol</span>
      </div>
      <div className="max-h-80 overflow-y-auto pr-1">
        {processedData.map((level) => (
          <div
            key={level.priceDisplay}
            className={cn(
              "flex justify-between items-center border-b border-dotted border-border/30 py-0.5",
              level.isPoc ? 'bg-primary/20 dark:bg-primary/30' : ''
            )}
          >
            <span className={cn(
              "w-1/3 text-center px-1 py-0.5 rounded-sm",
              level.sellVolume === 0 ? 'text-muted-foreground/50' : (level.isPoc ? 'text-primary-foreground font-semibold' : 'text-destructive'),
              level.sellImbalance && !level.isPoc && 'bg-destructive/20 text-destructive-foreground font-bold',
              level.sellImbalance && level.isPoc && 'bg-destructive/40 text-destructive-foreground font-bold'
            )}>
              {level.sellVolume > 0 ? `${level.sellVolume.toFixed(2)}` : '-'}
            </span>
            <span className={cn(
              "w-1/3 text-center font-medium",
               level.isPoc ? 'text-primary-foreground font-bold' : 'text-foreground'
            )}>
              {level.priceDisplay}
            </span>
            <span className={cn(
              "w-1/3 text-center px-1 py-0.5 rounded-sm",
              level.buyVolume === 0 ? 'text-muted-foreground/50' : (level.isPoc ? 'text-primary-foreground font-semibold' : 'text-accent'),
              level.buyImbalance && !level.isPoc && 'bg-accent/20 text-accent-foreground font-bold',
              level.buyImbalance && level.isPoc && 'bg-accent/40 text-accent-foreground font-bold'
            )}>
              {level.buyVolume > 0 ? `${level.buyVolume.toFixed(2)}` : '-'}
            </span>
          </div>
        ))}
      </div>
      {pocInfo && (
        <div className="text-center text-xs text-muted-foreground mt-1.5 pt-1 border-t border-border">
          POC: <span className="font-semibold text-primary">{pocInfo.priceDisplay}</span> (Total Vol: {pocInfo.totalVolume.toFixed(2)})
        </div>
      )}
    </div>
  );
};

export default GraphicalFootprintBar;

