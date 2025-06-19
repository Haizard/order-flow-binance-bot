
// src/app/(app)/footprint-charts/page.tsx
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, PlayCircle, StopCircle, BarChartHorizontalBig, Info, TrendingUp, TrendingDown, Maximize, Minimize, Activity, Target, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import type { FootprintBar, PriceLevelData } from '@/types/footprint';
import { MONITORED_MARKET_SYMBOLS } from '@/config/bot-strategy'; // Default symbols
import { useToast } from "@/hooks/use-toast";
import GraphicalFootprintBar from '@/components/footprint/GraphicalFootprintBar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from '@/lib/utils';

const AGGREGATION_INTERVAL_MS = 60 * 1000; // 1 minute, matches server-side
const DEFAULT_BARS_TO_DISPLAY = 10;
const VALUE_AREA_PERCENTAGE = 0.7; // 70% for VAH/VAL calculation

// Helper to format price consistently
const formatPrice = (price: number | undefined | null, defaultPrecision = 2): string => {
    if (price === undefined || price === null || isNaN(price)) return 'N/A';
    const precision = price !== 0 && Math.abs(price) < 1 ? 5 : defaultPrecision;
    return price.toFixed(precision);
};

// Helper to format volume consistently
const formatVolume = (volume: number | undefined | null): string => {
    if (volume === undefined || volume === null || isNaN(volume)) return 'N/A';
    return volume.toFixed(2);
};

// Helper to format time from timestamp
const formatTimeFromTimestamp = (timestamp: number | undefined | null, includeSeconds = true): string => {
    if (timestamp === undefined || timestamp === null || isNaN(timestamp)) return 'N/A';
    const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    if (includeSeconds) options.second = '2-digit';
    return new Date(timestamp).toLocaleTimeString([], options);
};


// Helper to calculate POC for the summary table for a single bar
function getBarPocInfo(bar: Partial<FootprintBar>): { pocPrice: string | null; pocVolume: number | null } {
  if (!bar.priceLevels) return { pocPrice: null, pocVolume: null };

  const levels = bar.priceLevels instanceof Map ? bar.priceLevels : new Map(Object.entries(bar.priceLevels));
  if (levels.size === 0) return { pocPrice: null, pocVolume: null };

  let maxVolume = -1;
  let pocPriceNum: number | null = null;

  levels.forEach((levelData, priceStr) => {
    const totalVolumeAtLevel = (levelData.buyVolume || 0) + (levelData.sellVolume || 0);
    if (totalVolumeAtLevel > maxVolume) {
      maxVolume = totalVolumeAtLevel;
      pocPriceNum = parseFloat(priceStr);
    }
  });

  return {
    pocPrice: pocPriceNum !== null ? formatPrice(pocPriceNum) : null,
    pocVolume: maxVolume > -1 ? parseFloat(maxVolume.toFixed(2)) : null
  };
}

interface SessionProfileMetrics {
  sessionPocPriceStr: string | null;
  sessionPocVolumeStr: string | null;
  vahStr: string | null;
  valStr: string | null;
}

// Helper to calculate Session POC, VAH, VAL
function calculateSessionVolumeProfileAndVA(bars: FootprintBar[]): SessionProfileMetrics {
  if (!bars || bars.length === 0) {
    return { sessionPocPriceStr: null, sessionPocVolumeStr: null, vahStr: null, valStr: null };
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
    return { sessionPocPriceStr: null, sessionPocVolumeStr: null, vahStr: null, valStr: null };
  }

  const sortedProfile = Array.from(sessionProfileMap.entries())
    .map(([price, volume]) => ({ price, volume }))
    .sort((a, b) => b.price - a.price); // Sort by price descending (high to low)

  let sessionPocPrice: number | null = null;
  let sessionPocVolume = 0;
  sortedProfile.forEach(level => {
    if (level.volume > sessionPocVolume) {
      sessionPocVolume = level.volume;
      sessionPocPrice = level.price;
    }
  });

  if (sessionPocPrice === null) {
    return { sessionPocPriceStr: null, sessionPocVolumeStr: null, vahStr: null, valStr: null };
  }

  const targetVolumeForVA = totalSessionVolume * VALUE_AREA_PERCENTAGE;
  let volumeInVA = 0;
  let currentVah = sessionPocPrice;
  let currentVal = sessionPocPrice;

  // Find POC index in sortedProfile
  const pocIndex = sortedProfile.findIndex(p => p.price === sessionPocPrice);
  if (pocIndex === -1) return { sessionPocPriceStr: formatPrice(sessionPocPrice), sessionPocVolumeStr: formatVolume(sessionPocVolume), vahStr: null, valStr: null };

  volumeInVA = sortedProfile[pocIndex].volume;

  let topPointer = pocIndex - 1;
  let bottomPointer = pocIndex + 1;

  while (volumeInVA < targetVolumeForVA) {
    const volAbove = topPointer >= 0 ? sortedProfile[topPointer].volume : -1;
    const volBelow = bottomPointer < sortedProfile.length ? sortedProfile[bottomPointer].volume : -1;

    if (volAbove === -1 && volBelow === -1) break; // No more levels to add

    if (volAbove > volBelow) {
      volumeInVA += volAbove;
      currentVah = sortedProfile[topPointer].price;
      topPointer--;
    } else if (volBelow >= volAbove) { // Includes case where volAbove is -1
      volumeInVA += volBelow;
      currentVal = sortedProfile[bottomPointer].price;
      bottomPointer++;
    }
  }

  return {
    sessionPocPriceStr: formatPrice(sessionPocPrice),
    sessionPocVolumeStr: formatVolume(sessionPocVolume),
    vahStr: formatPrice(currentVah),
    valStr: formatPrice(currentVal),
  };
}


export default function FootprintChartsPage() {
  const [symbolsInput, setSymbolsInput] = useState(MONITORED_MARKET_SYMBOLS.slice(0,3).join(','));
  const [activeSymbols, setActiveSymbols] = useState<string[]>([]);
  const [footprintBars, setFootprintBars] = useState<Record<string, FootprintBar[]>>({});
  const [currentPartialBars, setCurrentPartialBars] = useState<Record<string, Partial<FootprintBar>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [numBarsToDisplay, setNumBarsToDisplay] = useState<number>(DEFAULT_BARS_TO_DISPLAY);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { toast } = useToast();

  const handleNumBarsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value > 0 && value <= 50) {
      setNumBarsToDisplay(value);
    } else if (event.target.value === "") {
      setNumBarsToDisplay(DEFAULT_BARS_TO_DISPLAY); // Reset to default if empty
    }
  };

  const connectToStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (!symbolsInput.trim()) {
        toast({
            title: "Symbols Missing",
            description: "Please enter symbols to track.",
            variant: "destructive",
        });
        return;
    }

    const symbolsToConnect = symbolsInput.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
    if (symbolsToConnect.length === 0) {
        toast({
            title: "No Valid Symbols",
            description: "No valid symbols were entered.",
            variant: "destructive",
        });
        return;
    }
    setActiveSymbols(symbolsToConnect);
    setIsLoading(true);
    setIsConnected(false);
    setFootprintBars({});
    setCurrentPartialBars({});

    const url = `/api/footprint-stream?symbols=${symbolsToConnect.join(',')}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsLoading(false);
      setIsConnected(true);
      toast({
        title: "Stream Connected",
        description: `Connected to footprint data stream for: ${symbolsToConnect.join(', ')}`,
        variant: "default",
        className: "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700 text-green-800 dark:text-green-300",
      });
    };

    es.onerror = (event) => {
      let errorDetails = `Event Type: ${event.type}`;
      if (event.target && event.target instanceof EventSource) {
        errorDetails += `, ReadyState: ${event.target.readyState} (0=CONNECTING, 1=OPEN, 2=CLOSED)`;
      }
      console.error(`Client-side EventSource connection error. ${errorDetails}. This often indicates the server at /api/footprint-stream failed to establish the stream or the connection was interrupted. Check server logs for /api/footprint-stream errors.`);
      console.debug("Full EventSource error event object for debugging:", event);

      toast({
        title: "Stream Connection Error",
        description: "Lost connection to the data stream or failed to connect. Check console & server logs, then try reconnecting.",
        variant: "destructive",
      });

      setIsLoading(false);
      setIsConnected(false);
      setActiveSymbols([]);
      if (eventSourceRef.current) {
         eventSourceRef.current.close();
         eventSourceRef.current = null;
      }
    };

    es.addEventListener('footprintUpdate', (event) => {
      const rawData = JSON.parse(event.data);
      const reconstructedPriceLevels = rawData.priceLevels && typeof rawData.priceLevels === 'object'
        ? new Map<string, PriceLevelData>(Object.entries(rawData.priceLevels))
        : new Map<string, PriceLevelData>();

      const barData: FootprintBar = {
        ...rawData,
        timestamp: Number(rawData.timestamp), // Ensure timestamp is a number
        priceLevels: reconstructedPriceLevels,
      };

      setFootprintBars(prev => {
        const existingBars = prev[barData.symbol] || [];
        const updatedBars = [
            ...existingBars.filter(b => b.timestamp !== barData.timestamp),
            barData
        ].sort((a,b) => b.timestamp - a.timestamp) // Ensure latest first
         .slice(0, numBarsToDisplay); // Limit to numBarsToDisplay
        return { ...prev, [barData.symbol]: updatedBars };
      });
      // Initialize the next partial bar for this symbol
      setCurrentPartialBars(prev => ({
        ...prev,
        [barData.symbol]: {
          symbol: barData.symbol,
          timestamp: Number(barData.timestamp) + AGGREGATION_INTERVAL_MS, // Timestamp for the NEXT bar
          priceLevels: new Map<string, PriceLevelData>() // Start with an empty map
        }
      }));
    });

    es.addEventListener('footprintUpdatePartial', (event) => {
        const rawPartialData = JSON.parse(event.data);
        const partialBarDataWithMap: Partial<FootprintBar> = {
            ...rawPartialData,
            timestamp: Number(rawPartialData.timestamp) // Ensure timestamp is a number
        };

        // Ensure priceLevels is a Map
        if (rawPartialData.priceLevels && typeof rawPartialData.priceLevels === 'object' && !(rawPartialData.priceLevels instanceof Map)) {
            partialBarDataWithMap.priceLevels = new Map<string, PriceLevelData>(Object.entries(rawPartialData.priceLevels));
        }

        if(partialBarDataWithMap.symbol) {
            setCurrentPartialBars(prev => {
                const existingSymbolPartial = prev[partialBarDataWithMap.symbol!] || {};
                const mergedPartial: Partial<FootprintBar> = {
                  ...existingSymbolPartial, // Ensures we keep older fields if new data only has some
                  ...partialBarDataWithMap // Overwrite with new fields
                };

                // Merge priceLevels if both are maps
                if (partialBarDataWithMap.priceLevels instanceof Map && existingSymbolPartial.priceLevels instanceof Map) {
                    // Create a new map by merging existing and new entries
                    mergedPartial.priceLevels = new Map([...existingSymbolPartial.priceLevels, ...partialBarDataWithMap.priceLevels]);
                } else if (partialBarDataWithMap.priceLevels instanceof Map) {
                    // If only new data has priceLevels, use it
                    mergedPartial.priceLevels = partialBarDataWithMap.priceLevels;
                } else if (!mergedPartial.priceLevels) {
                    // If no priceLevels exist yet, initialize an empty map
                    mergedPartial.priceLevels = new Map<string, PriceLevelData>();
                }

                return {...prev, [partialBarDataWithMap.symbol!]: mergedPartial };
            });
        }
    });
  };

  const disconnectStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
    setActiveSymbols([]); // Clear active symbols as we are disconnected
    toast({
        title: "Stream Disconnected",
        description: "You have manually disconnected from the footprint data stream.",
        variant: "default",
    });
  };

  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);


  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Real-Time Footprint Data</h1>
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center w-full sm:w-auto">
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <Input
              type="text"
              placeholder="e.g., BTCUSDT,ETHUSDT"
              value={symbolsInput}
              onChange={(e) => setSymbolsInput(e.target.value)}
              className="sm:min-w-[200px] md:min-w-[250px]"
              disabled={isConnected || isLoading}
            />
            {!isConnected && !isLoading && (
              <Button onClick={connectToStream} disabled={!symbolsInput.trim()}>
                <PlayCircle className="mr-2 h-5 w-5" /> Connect
              </Button>
            )}
            {(isConnected || isLoading) && (
              <Button onClick={disconnectStream} variant="outline" disabled={isLoading && !isConnected}>
                {isLoading && !isConnected ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <StopCircle className="mr-2 h-5 w-5" />}
                {isLoading && !isConnected ? 'Connecting...' : 'Disconnect'}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="numBars" className="whitespace-nowrap text-sm">Bars:</Label>
            <Input
              id="numBars"
              type="number"
              min="1"
              max="50"
              value={numBarsToDisplay}
              onChange={handleNumBarsChange}
              className="w-20 h-10" // Standard ShadCN input height
              disabled={isConnected || isLoading}
            />
          </div>
        </div>
      </div>

       {isConnected && activeSymbols.length > 0 && (
         <div className="text-sm text-green-600 dark:text-green-400">
            Connected to stream for: {activeSymbols.join(', ')}. Displaying latest completed bar data.
         </div>
        )}
       {!isConnected && !isLoading && activeSymbols.length > 0 && (
         <div className="text-sm text-red-600 dark:text-red-400">
            Disconnected from stream. Last tracked symbols: {activeSymbols.join(', ')}.
         </div>
       )}

      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-6">
        {activeSymbols.map(symbol => {
          const currentSymbolPartialBar = currentPartialBars[symbol];
          const currentSymbolFootprintBars = footprintBars[symbol] || [];

          // Prepare data for the summary table (partial bar first, then completed bars)
          const summaryBarsData: Partial<FootprintBar>[] = [
            ...(currentSymbolPartialBar && (currentSymbolPartialBar.totalVolume || (currentSymbolPartialBar.priceLevels && currentSymbolPartialBar.priceLevels.size > 0)) ? [currentSymbolPartialBar] : []),
            ...currentSymbolFootprintBars
          ].slice(0, numBarsToDisplay + 1); // +1 for the potential partial bar

          const metrics = [
            { label: "Bar End Time", getValue: (bar: Partial<FootprintBar>) => bar.timestamp ? formatTimeFromTimestamp(Number(bar.timestamp) + AGGREGATION_INTERVAL_MS -1) : 'N/A' },
            { label: "Open", getValue: (bar: Partial<FootprintBar>) => formatPrice(bar.open) },
            { label: "High", getValue: (bar: Partial<FootprintBar>) => formatPrice(bar.high) },
            { label: "Low", getValue: (bar: Partial<FootprintBar>) => formatPrice(bar.low) },
            { label: "Close", getValue: (bar: Partial<FootprintBar>) => formatPrice(bar.close) },
            { label: "Volume", getValue: (bar: Partial<FootprintBar>) => formatVolume(bar.totalVolume) },
            {
              label: "Delta",
              getValue: (bar: Partial<FootprintBar>) => formatVolume(bar.delta),
              getCellClass: (bar: Partial<FootprintBar>) => (bar.delta ?? 0) >= 0 ? 'text-accent' : 'text-destructive'
            },
            {
              label: "Delta %",
              getValue: (bar: Partial<FootprintBar>) => {
                if (bar.totalVolume && bar.totalVolume > 0 && bar.delta !== undefined && bar.delta !== null) {
                  return `${((bar.delta / bar.totalVolume) * 100).toFixed(2)}%`;
                }
                return 'N/A';
              },
              getCellClass: (bar: Partial<FootprintBar>) => (bar.delta ?? 0) >= 0 ? 'text-accent' : 'text-destructive'
            },
            { label: "POC Price", getValue: (bar: Partial<FootprintBar>) => getBarPocInfo(bar).pocPrice || 'N/A' },
            { label: "POC Volume", getValue: (bar: Partial<FootprintBar>) => formatVolume(getBarPocInfo(bar).pocVolume) },
          ];

          // Calculate Session Statistics
          let sessionHigh: number | undefined = undefined;
          let sessionLow: number | undefined = undefined;
          let maxDeltaInSession: number | undefined = undefined;
          let minDeltaInSession: number | undefined = undefined;

          if (currentSymbolFootprintBars.length > 0) {
            sessionHigh = Math.max(...currentSymbolFootprintBars.map(b => b.high).filter(h => h !== undefined && h !== null) as number[]);
            sessionLow = Math.min(...currentSymbolFootprintBars.map(b => b.low).filter(l => l !== undefined && l !== null) as number[]);
            const deltas = currentSymbolFootprintBars.map(b => b.delta).filter(d => d !== undefined && d !== null) as number[];
            if (deltas.length > 0) {
              maxDeltaInSession = Math.max(...deltas);
              minDeltaInSession = Math.min(...deltas);
            }
          }
          
          const { sessionPocPriceStr, sessionPocVolumeStr, vahStr, valStr } = calculateSessionVolumeProfileAndVA(currentSymbolFootprintBars);


          return (
          <Card key={symbol} className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-headline">
                <BarChartHorizontalBig className="h-6 w-6 text-primary" />
                {symbol} - Footprint Aggregation
              </CardTitle>
              <CardDescription>
                Latest completed aggregate. Max {numBarsToDisplay} bars shown (+ current). Updates in real-time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && !currentSymbolFootprintBars.length && !(currentSymbolPartialBar?.priceLevels && (currentSymbolPartialBar.priceLevels.size > 0 || (currentSymbolPartialBar.totalVolume ?? 0) > 0) ) ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-2 text-muted-foreground">Waiting for data...</p>
                </div>
              ) : (
                <>
                  {/* Horizontal display of graphical bars */}
                  <div className="flex flex-row-reverse overflow-x-auto gap-1 pb-4 items-end min-h-[300px]">
                    {/* Current Aggregating Bar */}
                    {currentSymbolPartialBar && (currentSymbolPartialBar.totalVolume || (currentSymbolPartialBar.priceLevels && currentSymbolPartialBar.priceLevels.size > 0)) && (
                       <div className="min-w-[150px] flex-shrink-0 border border-dashed p-2 rounded-md bg-primary/5 flex flex-col">
                         <h4 className="font-medium text-xs mb-1 text-center text-primary">
                           {currentSymbolPartialBar.timestamp ? formatTimeFromTimestamp(currentSymbolPartialBar.timestamp, false) : 'N/A'} (Agg.)
                         </h4>
                         <GraphicalFootprintBar bar={currentSymbolPartialBar} />
                       </div>
                     )}
                    {/* Completed Bars */}
                    {currentSymbolFootprintBars.slice(0, numBarsToDisplay).reverse().map(bar => ( // reverse to show oldest on left
                      <div key={bar.timestamp} className="min-w-[150px] flex-shrink-0 border p-2 rounded-md bg-card flex flex-col">
                        <h4 className="font-medium text-xs mb-1 text-center">
                          {formatTimeFromTimestamp(bar.timestamp, false)}
                        </h4>
                        <GraphicalFootprintBar bar={bar} />
                      </div>
                    ))}
                  </div>
                  {currentSymbolFootprintBars.length === 0 && !(currentSymbolPartialBar?.priceLevels && currentSymbolPartialBar.priceLevels.size > 0) && !isLoading &&
                    <p className="text-muted-foreground text-center py-4">No complete bar data received yet for {symbol}.</p>
                  }

                  {currentSymbolFootprintBars.length > 0 && (
                     <Card className="mt-6 shadow-md">
                      <CardHeader className="py-3 px-4 border-b">
                        <CardTitle className="text-md font-semibold flex items-center gap-2">
                          <Activity className="h-5 w-5 text-primary/80" />
                          Session Statistics (Visible Completed Bars)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center"><Maximize className="h-3.5 w-3.5 mr-1.5 text-green-500"/>Session High:</span>
                          <span className="font-semibold">{formatPrice(sessionHigh)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center"><TrendingUp className="h-3.5 w-3.5 mr-1.5 text-green-500"/>Max Delta:</span>
                          <span className={cn("font-semibold", (maxDeltaInSession ?? 0) >=0 ? "text-accent" : "text-destructive")}>{formatVolume(maxDeltaInSession)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center"><Minimize className="h-3.5 w-3.5 mr-1.5 text-red-500"/>Session Low:</span>
                          <span className="font-semibold">{formatPrice(sessionLow)}</span>
                        </div>
                         <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center"><TrendingDown className="h-3.5 w-3.5 mr-1.5 text-red-500"/>Min Delta:</span>
                          <span className={cn("font-semibold", (minDeltaInSession ?? 0) >=0 ? "text-accent" : "text-destructive")}>{formatVolume(minDeltaInSession)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground flex items-center"><Target className="h-3.5 w-3.5 mr-1.5 text-primary/70"/>Session POC:</span>
                            <span className="font-semibold">{sessionPocPriceStr || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center col-span-1 sm:col-span-2"> {/* POC Volume can span */}
                            <span className="text-muted-foreground flex items-center"><Info className="h-3.5 w-3.5 mr-1.5 text-primary/70"/>Session POC Vol:</span>
                            <span className="font-semibold">{sessionPocVolumeStr || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground flex items-center"><ArrowUpCircle className="h-3.5 w-3.5 mr-1.5 text-blue-500"/>Value Area High:</span>
                            <span className="font-semibold">{vahStr || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground flex items-center"><ArrowDownCircle className="h-3.5 w-3.5 mr-1.5 text-blue-500"/>Value Area Low:</span>
                            <span className="font-semibold">{valStr || 'N/A'}</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}


                  {summaryBarsData.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold mb-3 flex items-center">
                        <Info className="h-5 w-5 mr-2 text-primary/80" />
                        Bar Summary Statistics
                      </h3>
                      <div className="overflow-x-auto rounded-md border">
                        <Table className="min-w-full text-xs">
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead className="px-2 py-2 font-medium text-muted-foreground sticky left-0 bg-muted/50 z-10 whitespace-nowrap">Metric</TableHead>
                              {summaryBarsData.map((sBar, index) => (
                                <TableHead key={sBar.timestamp || `partial-col-${index}`} className="px-2 py-2 font-medium text-muted-foreground text-center whitespace-nowrap">
                                  {formatTimeFromTimestamp(sBar.timestamp, false)}
                                  {index === 0 && currentSymbolPartialBar && (currentSymbolPartialBar.totalVolume || (currentSymbolPartialBar.priceLevels && currentSymbolPartialBar.priceLevels.size > 0)) ? <span className="text-primary/80 ml-1">(Agg.)</span> : ""}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {metrics.map(metric => (
                              <TableRow key={metric.label} className="hover:bg-muted/20">
                                <TableCell className="px-2 py-1.5 font-medium sticky left-0 bg-background border-r whitespace-nowrap">
                                  {metric.label}
                                </TableCell>
                                {summaryBarsData.map((sBar, index) => (
                                  <TableCell
                                    key={`${metric.label}-${sBar.timestamp || `partial-cell-${index}`}`}
                                    className={cn(
                                      "px-2 py-1.5 text-center tabular-nums whitespace-nowrap",
                                      metric.getCellClass ? metric.getCellClass(sBar) : '',
                                      index === 0 && currentSymbolPartialBar && (currentSymbolPartialBar.totalVolume || (currentSymbolPartialBar.priceLevels && currentSymbolPartialBar.priceLevels.size > 0)) && "bg-primary/5"
                                    )}
                                  >
                                    {metric.getValue(sBar)}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )})}
        {activeSymbols.length === 0 && !isLoading && (
            <Card className="md:col-span-1 lg:col-span-2">
                <CardContent className="pt-6">
                    <p className="text-muted-foreground text-center py-10">
                        Enter symbols (e.g., BTCUSDT,ETHUSDT) and click "Connect" to start viewing footprint data.
                    </p>
                </CardContent>
            </Card>
        )}
      </div>
    </div>
  );
}

