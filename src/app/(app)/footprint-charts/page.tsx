
// src/app/(app)/footprint-charts/page.tsx
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, PlayCircle, StopCircle, BarChartHorizontalBig } from 'lucide-react';
import type { FootprintBar, PriceLevelData } from '@/types/footprint';
import { MONITORED_MARKET_SYMBOLS } from '@/config/bot-strategy'; // Default symbols
import { useToast } from "@/hooks/use-toast";
import GraphicalFootprintBar from '@/components/footprint/GraphicalFootprintBar'; // Import the new component

const AGGREGATION_INTERVAL_MS = 60 * 1000; // 1 minute, matches server-side

export default function FootprintChartsPage() {
  const [symbolsInput, setSymbolsInput] = useState(MONITORED_MARKET_SYMBOLS.slice(0,3).join(','));
  const [activeSymbols, setActiveSymbols] = useState<string[]>([]);
  const [footprintBars, setFootprintBars] = useState<Record<string, FootprintBar[]>>({});
  const [currentPartialBars, setCurrentPartialBars] = useState<Record<string, Partial<FootprintBar>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { toast } = useToast();

  const connectToStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
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
      let errorDetails = `Type: ${event.type}`;
      if (event.target && event.target instanceof EventSource) {
        errorDetails += `, ReadyState: ${event.target.readyState} (0=CONNECTING, 1=OPEN, 2=CLOSED)`;
      }
      console.error(`EventSource connection error occurred. Details: ${errorDetails}.`);
      console.debug("Full EventSource error event object for debugging:", event);

      toast({
        title: "Stream Connection Error",
        description: "Lost connection to the data stream or failed to connect. Check console & network tab, then try reconnecting.",
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
      // console.log(`[Client] footprintUpdate for ${rawData.symbol}: RAW rawData.priceLevels from SSE:`, JSON.stringify(rawData.priceLevels));
      const reconstructedPriceLevels = new Map<string, PriceLevelData>(Object.entries(rawData.priceLevels || {}));
      // console.log(`[Client] footprintUpdate for ${rawData.symbol}: Reconstructed priceLevels size: ${reconstructedPriceLevels.size}`, reconstructedPriceLevels.size > 0 ? Array.from(reconstructedPriceLevels.keys()) : "Map is empty");

      const barData: FootprintBar = {
        ...rawData,
        timestamp: Number(rawData.timestamp),
        priceLevels: reconstructedPriceLevels,
      };

      setFootprintBars(prev => {
        const existingBars = prev[barData.symbol] || [];
        const updatedBars = [
            ...existingBars.filter(b => b.timestamp !== barData.timestamp),
            barData
        ].sort((a,b) => b.timestamp - a.timestamp).slice(0, 10);
        return { ...prev, [barData.symbol]: updatedBars };
      });
      // Initialize the next partial bar correctly, ensuring timestamp is a number
      setCurrentPartialBars(prev => ({...prev, [barData.symbol]: { symbol: barData.symbol, timestamp: Number(barData.timestamp) + AGGREGATION_INTERVAL_MS, priceLevels: new Map()}}));
    });

    es.addEventListener('footprintUpdatePartial', (event) => {
        const rawPartialData = JSON.parse(event.data);
        const partialBarDataWithMap: Partial<FootprintBar> = { 
            ...rawPartialData,
            timestamp: Number(rawPartialData.timestamp)
        };

        if (rawPartialData.priceLevels) {
            // console.log(`[Client] footprintUpdatePartial for ${rawPartialData.symbol}: RAW rawPartialData.priceLevels from SSE:`, JSON.stringify(rawPartialData.priceLevels));
            partialBarDataWithMap.priceLevels = new Map<string, PriceLevelData>(Object.entries(rawPartialData.priceLevels));
            // console.log(`[Client] footprintUpdatePartial for ${rawPartialData.symbol}: Reconstructed partial priceLevels size: ${partialBarDataWithMap.priceLevels.size}`);
        }

        if(partialBarDataWithMap.symbol) {
            setCurrentPartialBars(prev => {
                const existingSymbolPartial = prev[partialBarDataWithMap.symbol!] || {};
                const mergedPartial: Partial<FootprintBar> = { 
                  ...existingSymbolPartial, 
                  ...partialBarDataWithMap 
                };
                
                if (rawPartialData.priceLevels && existingSymbolPartial.priceLevels instanceof Map) {
                    const newLevels = partialBarDataWithMap.priceLevels as Map<string, PriceLevelData>;
                    mergedPartial.priceLevels = new Map([...existingSymbolPartial.priceLevels, ...newLevels]);
                } else if (rawPartialData.priceLevels) { 
                    mergedPartial.priceLevels = partialBarDataWithMap.priceLevels;
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
    setActiveSymbols([]); 
    toast({
        title: "Stream Disconnected",
        description: "You have manually disconnected from the footprint data stream.",
        variant: "default",
    });
  };

  useEffect(() => {
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
        <div className="flex gap-2 items-center w-full sm:w-auto">
          <Input
            type="text"
            placeholder="e.g., BTCUSDT,ETHUSDT"
            value={symbolsInput}
            onChange={(e) => setSymbolsInput(e.target.value)}
            className="sm:min-w-[250px]"
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


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6"> {/* Adjusted to lg:grid-cols-2 for better chart space */}
        {activeSymbols.map(symbol => (
          <Card key={symbol} className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-headline">
                <BarChartHorizontalBig className="h-6 w-6 text-primary" />
                {symbol} - Footprint Aggregation
              </CardTitle>
              <CardDescription>
                Latest completed 1-min aggregate. Updates in real-time. Max 10 bars shown.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && !footprintBars[symbol]?.length && !(currentPartialBars[symbol]?.priceLevels && ((currentPartialBars[symbol]?.priceLevels as Map<string,PriceLevelData>)?.size > 0 || (currentPartialBars[symbol]?.totalVolume ?? 0) > 0) ) ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-2 text-muted-foreground">Waiting for data...</p>
                </div>
              ) : (
                <>
                  {currentPartialBars[symbol] && Object.keys(currentPartialBars[symbol]).length > 0 && (
                    <div className="mb-4 p-3 border border-dashed rounded-md bg-primary/5">
                      <p className="text-sm font-semibold text-primary mb-1">Current Aggregating Bar (Partial):</p>
                      <p className="text-xs">
                        Timestamp: {currentPartialBars[symbol].timestamp ? new Date(currentPartialBars[symbol].timestamp!).toLocaleString() : 'N/A'}
                      </p>
                      <p className="text-xs">
                        O: {currentPartialBars[symbol].open?.toFixed(Math.max(2, (currentPartialBars[symbol].open ?? 0) < 1 ? 5 : 2)) ?? 'N/A'} H: {currentPartialBars[symbol].high?.toFixed(Math.max(2, (currentPartialBars[symbol].high ?? 0) < 1 ? 5 : 2)) ?? 'N/A'} L: {currentPartialBars[symbol].low?.toFixed(Math.max(2, (currentPartialBars[symbol].low ?? 0) < 1 ? 5 : 2)) ?? 'N/A'} C: {currentPartialBars[symbol].close?.toFixed(Math.max(2, (currentPartialBars[symbol].close ?? 0) < 1 ? 5 : 2)) ?? 'N/A'}
                      </p>
                      <p className="text-xs">
                        Volume: {currentPartialBars[symbol].totalVolume?.toFixed(2) ?? 'N/A'} Delta: {currentPartialBars[symbol].delta?.toFixed(2) ?? 'N/A'}
                      </p>
                      {(currentPartialBars[symbol].priceLevels && ((currentPartialBars[symbol].priceLevels instanceof Map && (currentPartialBars[symbol].priceLevels as Map<string, PriceLevelData>).size > 0) || (typeof currentPartialBars[symbol].priceLevels === 'object' && Object.keys(currentPartialBars[symbol].priceLevels!).length > 0)) || (currentPartialBars[symbol].totalVolume ?? 0 > 0)) ? (
                        <GraphicalFootprintBar bar={currentPartialBars[symbol]} />
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1 py-2 text-center">Aggregating price levels...</p>
                      )}
                    </div>
                  )}
                  {(footprintBars[symbol] && footprintBars[symbol].length > 0) ? (
                     footprintBars[symbol].map(bar => (
                       <div key={bar.timestamp} className="mb-6 last:mb-0"> {/* Increased mb for completed bars */}
                         <h4 className="font-medium text-sm mb-1">
                           Bar: {new Date(bar.timestamp).toLocaleTimeString()} - {new Date(Number(bar.timestamp) + AGGREGATION_INTERVAL_MS -1).toLocaleTimeString()}
                         </h4>
                         <p className="text-xs text-muted-foreground">
                            O:{bar.open.toFixed(Math.max(2, bar.open < 1 ? 5 : 2))} H:{bar.high.toFixed(Math.max(2, bar.high < 1 ? 5 : 2))} L:{bar.low.toFixed(Math.max(2, bar.low < 1 ? 5 : 2))} C:{bar.close.toFixed(Math.max(2, bar.close < 1 ? 5 : 2))} Vol:{bar.totalVolume.toFixed(2)} Delta:{bar.delta.toFixed(2)}
                         </p>
                         <GraphicalFootprintBar bar={bar} />
                       </div>
                     ))
                  ) : (
                    !currentPartialBars[symbol]?.priceLevels && <p className="text-muted-foreground text-center py-4">No complete bar data received yet for {symbol}.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
        {activeSymbols.length === 0 && !isLoading && (
            <Card className="md:col-span-2 lg:col-span-2"> {/* Adjusted colspan */}
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
