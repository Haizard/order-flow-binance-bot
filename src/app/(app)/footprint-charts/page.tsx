
// src/app/(app)/footprint-charts/page.tsx
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, PlayCircle, StopCircle, BarChartHorizontalBig, ListFilter } from 'lucide-react';
import type { FootprintBar, PriceLevelData } from '@/types/footprint';
import { MONITORED_MARKET_SYMBOLS } from '@/config/bot-strategy'; // Default symbols
import { useToast } from "@/hooks/use-toast";
import GraphicalFootprintBar from '@/components/footprint/GraphicalFootprintBar'; 

const AGGREGATION_INTERVAL_MS = 60 * 1000; // 1 minute, matches server-side
const DEFAULT_BARS_TO_DISPLAY = 10;

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
    if (!isNaN(value) && value > 0 && value <= 50) { // Basic validation: positive and not excessively large
      setNumBarsToDisplay(value);
    } else if (event.target.value === "") {
      setNumBarsToDisplay(DEFAULT_BARS_TO_DISPLAY); // Reset to default if input is cleared
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
      // Updated console.error message for clarity
      console.error(`Client-side EventSource connection error. ${errorDetails}. The server likely failed to establish the stream.`);
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
      const reconstructedPriceLevels = new Map<string, PriceLevelData>(Object.entries(rawData.priceLevels || {}));
      
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
        ].sort((a,b) => b.timestamp - a.timestamp) 
         .slice(0, numBarsToDisplay); 
        return { ...prev, [barData.symbol]: updatedBars };
      });
      setCurrentPartialBars(prev => ({
        ...prev, 
        [barData.symbol]: { 
          symbol: barData.symbol, 
          timestamp: Number(barData.timestamp) + AGGREGATION_INTERVAL_MS, 
          priceLevels: new Map<string, PriceLevelData>() 
        }
      }));
    });

    es.addEventListener('footprintUpdatePartial', (event) => {
        const rawPartialData = JSON.parse(event.data);
        const partialBarDataWithMap: Partial<FootprintBar> = { 
            ...rawPartialData,
            timestamp: Number(rawPartialData.timestamp)
        };

        if (rawPartialData.priceLevels && typeof rawPartialData.priceLevels === 'object' && !(rawPartialData.priceLevels instanceof Map)) {
            partialBarDataWithMap.priceLevels = new Map<string, PriceLevelData>(Object.entries(rawPartialData.priceLevels));
        }

        if(partialBarDataWithMap.symbol) {
            setCurrentPartialBars(prev => {
                const existingSymbolPartial = prev[partialBarDataWithMap.symbol!] || {};
                const mergedPartial: Partial<FootprintBar> = { 
                  ...existingSymbolPartial, 
                  ...partialBarDataWithMap 
                };
                
                if (partialBarDataWithMap.priceLevels instanceof Map && existingSymbolPartial.priceLevels instanceof Map) {
                    mergedPartial.priceLevels = new Map([...existingSymbolPartial.priceLevels, ...partialBarDataWithMap.priceLevels]);
                } else if (partialBarDataWithMap.priceLevels instanceof Map) {
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
              className="w-20 h-10"
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
        {activeSymbols.map(symbol => (
          <Card key={symbol} className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-headline">
                <BarChartHorizontalBig className="h-6 w-6 text-primary" />
                {symbol} - Footprint Aggregation
              </CardTitle>
              <CardDescription>
                Latest completed {numBarsToDisplay}-min aggregate. Updates in real-time. Max {numBarsToDisplay} bars shown.
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
                      {(currentPartialBars[symbol]?.priceLevels && ((currentPartialBars[symbol]?.priceLevels instanceof Map && (currentPartialBars[symbol].priceLevels as Map<string, PriceLevelData>).size > 0) || (typeof currentPartialBars[symbol].priceLevels === 'object' && Object.keys(currentPartialBars[symbol].priceLevels!).length > 0)) || (currentPartialBars[symbol].totalVolume ?? 0 > 0)) ? (
                        <GraphicalFootprintBar bar={currentPartialBars[symbol]} />
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1 py-2 text-center">Aggregating price levels...</p>
                      )}
                    </div>
                  )}
                  {(footprintBars[symbol] && footprintBars[symbol].length > 0) ? (
                     footprintBars[symbol].map(bar => (
                       <div key={bar.timestamp} className="mb-6 last:mb-0"> 
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
                    !(currentPartialBars[symbol]?.priceLevels && ((currentPartialBars[symbol]?.priceLevels instanceof Map && (currentPartialBars[symbol].priceLevels as Map<string, PriceLevelData>).size > 0) || (typeof currentPartialBars[symbol].priceLevels === 'object' && Object.keys(currentPartialBars[symbol].priceLevels!).length > 0))) &&
                    <p className="text-muted-foreground text-center py-4">No complete bar data received yet for {symbol}.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
        {activeSymbols.length === 0 && !isLoading && (
            <Card className="md:col-span-1 lg:col-span-2"> {/* Adjusted span for placeholder */}
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

