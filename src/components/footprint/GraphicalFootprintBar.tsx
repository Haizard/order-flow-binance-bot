
'use client';

import React, { useEffect, useState } from 'react';
import type { FootprintBar, PriceLevelData } from '@/types/footprint';
import { cn } from '@/lib/utils';

interface GraphicalFootprintBarProps {
  bar: Partial<FootprintBar>;
  sessionVah?: number | null;
  sessionVal?: number | null;
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
  ohlcMarkers?: string[];
  isInSessionValueArea?: boolean;
}

const IMBALANCE_RATIO = 3.0; 

const GraphicalFootprintBar: React.FC<GraphicalFootprintBarProps> = ({ bar, sessionVah, sessionVal }) => {
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

    let isEmptyBar = false;
    if (priceLevelsMap.size === 0) isEmptyBar = true;
    
    if (isEmptyBar && (bar.totalVolume === undefined || bar.totalVolume === 0)) {
        setProcessedData([]);
        setPocInfo(null);
        return;
    }
    if (isEmptyBar) { 
        setProcessedData([]); 
        setPocInfo(null);
    }

    const { open, high, low, close } = bar;

    const sortedLevels: Omit<ProcessedPriceLevel, 'isPoc' | 'buyImbalance' | 'sellImbalance' | 'ohlcMarkers' | 'isInSessionValueArea'>[] = Array.from(priceLevelsMap.entries())
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
      .sort((a, b) => b.priceValue - a.priceValue); 

    if (sortedLevels.length === 0 && bar.totalVolume && bar.totalVolume > 0) {
        setProcessedData([]);
        setPocInfo(null);
    } else if (sortedLevels.length === 0) {
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

    const finalProcessedData: ProcessedPriceLevel[] = sortedLevels.map((level, index, arr) => {
      let buyImbalance = false;
      let sellImbalance = false;
      const currentOhlcMarkers: string[] = [];
      let isInSessionValueArea = false;

      if (open !== undefined && level.priceValue === open) currentOhlcMarkers.push('O');
      if (high !== undefined && level.priceValue === high) currentOhlcMarkers.push('H');
      if (low !== undefined && level.priceValue === low) currentOhlcMarkers.push('L');
      if (close !== undefined && level.priceValue === close) currentOhlcMarkers.push('C');

      const levelBelow = arr[index + 1]; 
      if (levelBelow) { 
        if (levelBelow.sellVolume === 0 && level.buyVolume > 0) { 
          buyImbalance = true;
        } else if (levelBelow.sellVolume > 0 && level.buyVolume >= levelBelow.sellVolume * IMBALANCE_RATIO) {
          buyImbalance = true;
        }
      } else if (level.buyVolume > 0 && arr.length > 1) { 
         buyImbalance = true;
      }

      const levelAbove = arr[index - 1]; 
      if (levelAbove) { 
        if (levelAbove.buyVolume === 0 && level.sellVolume > 0) { 
          sellImbalance = true;
        } else if (levelAbove.buyVolume > 0 && level.sellVolume >= levelAbove.buyVolume * IMBALANCE_RATIO) {
          sellImbalance = true;
        }
      } else if (level.sellVolume > 0 && arr.length > 1) { 
        sellImbalance = true;
      }

      if (sessionVah !== undefined && sessionVah !== null && 
          sessionVal !== undefined && sessionVal !== null) {
        if (level.priceValue <= sessionVah && level.priceValue >= sessionVal) {
          isInSessionValueArea = true;
        }
      }
      
      return {
        ...level,
        isPoc: level.priceDisplay === currentPocDisplay,
        buyImbalance,
        sellImbalance,
        ohlcMarkers: currentOhlcMarkers,
        isInSessionValueArea,
      };
    });
    
    setProcessedData(finalProcessedData);

  }, [bar, sessionVah, sessionVal]);

  const getVolumeDisplay = (volume: number) => {
    if (volume === 0) return <span className="text-muted-foreground/60">-</span>;
    if (volume < 0.01 && volume > 0) return volume.toFixed(Math.max(2, Number(volume.toString().split('.')[1]?.length || 2) ));
    return volume.toFixed(2);
  };
  
  let isEmptyBarDisplay = false;
  const priceLevels = bar?.priceLevels;
  if (!priceLevels) {
    isEmptyBarDisplay = true;
  } else if (priceLevels instanceof Map) {
    if (priceLevels.size === 0) isEmptyBarDisplay = true;
  } else if (typeof priceLevels === 'object' && priceLevels !== null) {
    if (Object.keys(priceLevels).length === 0) isEmptyBarDisplay = true;
  } else {
      isEmptyBarDisplay = true; 
  }

  if (isEmptyBarDisplay && (bar.totalVolume === 0 || bar.totalVolume === undefined)) {
    return <p className="text-muted-foreground text-xs py-2 text-center italic">No trades or price level data for this bar.</p>;
  }
   if (processedData.length === 0 && (bar.totalVolume !== undefined && bar.totalVolume > 0)) {
     return <p className="text-muted-foreground text-xs py-2 text-center italic">Aggregating volume data...</p>;
   }
    if (processedData.length === 0) {
      return <p className="text-muted-foreground text-xs py-2 text-center italic">No price levels to display.</p>;
    }

  return (
    <div className="mt-2 w-full font-mono text-[11px] tabular-nums leading-tight">
      <div className="flex justify-between items-center px-1 py-0.5 bg-muted/50 rounded-t-md border-b border-border sticky top-0 z-10 text-xs">
        <span className="w-1/3 text-center font-semibold">Sell Vol</span>
        <span className="w-1/3 text-center font-semibold">Price</span>
        <span className="w-1/3 text-center font-semibold">Buy Vol</span>
      </div>
      <div className="max-h-72 overflow-y-auto pr-1"> 
        {processedData.map((level) => (
          <div
            key={level.priceDisplay}
            className={cn(
              "flex justify-between items-center border-b border-dotted border-border/30 py-[1px] min-h-[18px]", 
              level.isPoc ? 'bg-primary/20 dark:bg-primary/30' : 
              level.isInSessionValueArea ? 'bg-blue-500/10 dark:bg-blue-700/20' : ''
            )}
          >
            <span className={cn(
              "w-1/3 text-center px-1 py-0.5 rounded-sm",
              level.sellVolume === 0 ? 'text-muted-foreground/50' : (level.isPoc ? 'text-primary-foreground font-semibold' : 'text-destructive'),
              level.sellImbalance && !level.isPoc && 'bg-destructive/20 text-destructive-foreground font-bold',
              level.sellImbalance && level.isPoc && 'bg-destructive/40 text-destructive-foreground font-bold'
            )}>
              {getVolumeDisplay(level.sellVolume)}
            </span>
            
            <span className={cn(
              "w-1/3 text-center font-medium px-1 relative flex items-center justify-center", 
              level.isPoc ? 'text-primary-foreground font-bold' : 'text-foreground'
            )}>
              <span className="flex-grow text-center">{level.priceDisplay}</span>
              {level.ohlcMarkers && level.ohlcMarkers.length > 0 && (
                <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/70 font-light tracking-tight bg-background/40 dark:bg-popover/60 px-0.5 rounded-sm leading-none">
                  {level.ohlcMarkers.join('')}
                </span>
              )}
            </span>

            <span className={cn(
              "w-1/3 text-center px-1 py-0.5 rounded-sm",
              level.buyVolume === 0 ? 'text-muted-foreground/50' : (level.isPoc ? 'text-primary-foreground font-semibold' : 'text-accent'),
              level.buyImbalance && !level.isPoc && 'bg-accent/20 text-accent-foreground font-bold',
              level.buyImbalance && level.isPoc && 'bg-accent/40 text-accent-foreground font-bold'
            )}>
              {getVolumeDisplay(level.buyVolume)}
            </span>
          </div>
        ))}
      </div>
      {pocInfo && (
        <div className="text-center text-[10px] text-muted-foreground mt-1.5 pt-1 border-t border-border"> 
          POC: <span className="font-semibold text-primary">{pocInfo.priceDisplay}</span> (Total Vol: {pocInfo.totalVolume.toFixed(2)})
        </div>
      )}
    </div>
  );
};

export default GraphicalFootprintBar;

