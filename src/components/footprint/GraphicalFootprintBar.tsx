
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
}

const GraphicalFootprintBar: React.FC<GraphicalFootprintBarProps> = ({ bar }) => {
  const [pocInfo, setPocInfo] = useState<{ priceDisplay: string; totalVolume: number } | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedPriceLevel[]>([]);

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

    const data: ProcessedPriceLevel[] = Array.from(priceLevelsMap.entries())
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
    
    setProcessedData(data);

    // Calculate POC
    if (data.length > 0) {
      let maxVolume = -1;
      let currentPoc: { priceDisplay: string; totalVolume: number } | null = null;
      data.forEach(level => {
        if (level.totalVolumeAtLevel > maxVolume) {
          maxVolume = level.totalVolumeAtLevel;
          currentPoc = { priceDisplay: level.priceDisplay, totalVolume: maxVolume };
        }
      });
      setPocInfo(currentPoc);
    } else {
      setPocInfo(null);
    }

  }, [bar]);

  const isMap = bar.priceLevels instanceof Map;
  const isPlainObject = typeof bar.priceLevels === 'object' && bar.priceLevels !== null && !isMap;

  if (!bar || !bar.priceLevels) {
    return <p className="text-muted-foreground text-xs py-2 text-center">No price level data for display.</p>;
  }
  
  let isEmpty = false;
  if (isMap) {
    if ((bar.priceLevels as Map<string, PriceLevelData>).size === 0) isEmpty = true;
  } else if (isPlainObject) {
    if (Object.keys(bar.priceLevels as Record<string, PriceLevelData>).length === 0) isEmpty = true;
  } else {
    return <p className="text-muted-foreground text-xs py-2 text-center">Price level data is not a valid Map or Object.</p>;
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
    <div className="mt-2 w-full font-mono text-xs">
      <div className="flex justify-between items-center px-1 py-0.5 bg-muted/50 rounded-t-md border-b border-border">
        <span className="w-1/3 text-center font-semibold">Sell Vol</span>
        <span className="w-1/3 text-center font-semibold">Price</span>
        <span className="w-1/3 text-center font-semibold">Buy Vol</span>
      </div>
      <div className="max-h-80 overflow-y-auto pr-1"> {/* Added pr-1 for scrollbar spacing */}
        {processedData.map((level) => (
          <div
            key={level.priceDisplay}
            className={cn(
              "flex justify-between items-center border-b border-dotted border-border/30 py-0.5",
              level.priceDisplay === pocInfo?.priceDisplay ? 'bg-primary/20 font-bold text-primary-foreground' : ''
            )}
          >
            <span className={cn(
              "w-1/3 text-center px-1",
              level.sellVolume === 0 ? 'text-muted-foreground/70' : 'text-destructive-foreground',
              level.priceDisplay === pocInfo?.priceDisplay ? 'text-primary-foreground' : (level.sellVolume > 0 ? 'text-destructive' : '')
            )}>
              {level.sellVolume > 0 ? `x${level.sellVolume.toFixed(2)}` : '-'}
            </span>
            <span className={cn(
              "w-1/3 text-center font-medium",
              level.priceDisplay === pocInfo?.priceDisplay ? 'text-primary-foreground' : 'text-foreground'
            )}>
              {level.priceDisplay}
            </span>
            <span className={cn(
              "w-1/3 text-center px-1",
              level.buyVolume === 0 ? 'text-muted-foreground/70' : 'text-accent-foreground',
              level.priceDisplay === pocInfo?.priceDisplay ? 'text-primary-foreground' : (level.buyVolume > 0 ?'text-accent' : '')
            )}>
              {level.buyVolume > 0 ? `x${level.buyVolume.toFixed(2)}` : '-'}
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
