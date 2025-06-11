
// src/app/(app)/footprint-charts/page.tsx
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, PlayCircle, StopCircle, BarChartHorizontalBig } from 'lucide-react';
import type { FootprintBar, PriceLevelData } from '@/types/footprint';
import { MONITORED_MARKET_SYMBOLS } from '@/config/bot-strategy'; // Default symbols

// A very basic component to display one footprint bar's price levels
// This is NOT the complex visual chart, just a textual/simple bar representation for now.
const SimpleFootprintBarDisplay: React.FC<{ bar: FootprintBar }> = ({ bar }) => {
  if (!bar || !bar.priceLevels) {
    return <p className="text-muted-foreground">No bar data or price levels available.</p>;
  }

  const sortedPriceLevels = Array.from(bar.priceLevels.entries())
    .map(([price, data]) => ({ price: parseFloat(price), ...data }))
    .sort((a, b) => b.price - a.price); // Highest price on top

  const maxVolumeAtLevel = Math.max(...sortedPriceLevels.map(pl => Math.max(pl.buyVolume, pl.sellVolume)), 0);

  return (
    <div className="mt-2 space-y-1 text-xs border p-2 rounded-md bg-muted/30 max-h-96 overflow-y-auto">
      <div className="grid grid-cols-3 items-center gap-x-2 font-semibold sticky top-0 bg-muted/30 py-1 z-10">
        <div className="text-right">Sell Vol</div>
        <div className="text-center">Price</div>
        <div>Buy Vol</div>
      </div>
      {sortedPriceLevels.map(({ price, buyVolume, sellVolume }) => (
        <div key={price} className="grid grid-cols-3 items-center gap-x-1 hover:bg-muted/50">
          <div className="text-right text-red-500 relative h-4">
            <div 
              className="absolute right-0 top-0 bottom-0 bg-red-500/30" 
              style={{ width: maxVolumeAtLevel > 0 ? `${(sellVolume / maxVolumeAtLevel) * 100}%` : '0%' }}
            />
            <span className="relative pr-1">{sellVolume.toFixed(2)}</span>
          </div>
          <div className="text-center font-mono px-1 py-0.5 rounded bg-background shadow-sm">
            {price.toFixed(Math.max(2, (price < 1 ? 4 : 2)))}
          </div>
          <div className="text-left text-green-500 relative h-4">
            <div 
              className="absolute left-0 top-0 bottom-0 bg-green-500/30"
              style={{ width: maxVolumeAtLevel > 0 ? `${(buyVolume / maxVolumeAtLevel) * 100}%` : '0%' }}
            />
            <span className="relative pl-1">{buyVolume.toFixed(2)}</span>
          </div>
        </div>
      ))}
      {sortedPriceLevels.length === 0 && <p className="text-center text-muted-foreground py-4">No price level data in this bar.</p>}
    </div>
  );
};


export default function FootprintChartsPage() {
  const [symbolsInput, setSymbolsInput] = useState(MONITORED_MARKET_SYMBOLS.slice(0,3).join(',')); // Default to first 3
  const [activeSymbols, setActiveSymbols] = useState<string[]>([]);
  const [footprintBars, setFootprintBars] = useState<Record<string, FootprintBar[]>>({});
  const [currentPartialBars, setCurrentPartialBars] = useState<Record<string, Partial<FootprintBar>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connectToStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (!symbolsInput.trim()) {
        alert("Please enter symbols to track.");
        return;
    }

    const symbolsToConnect = symbolsInput.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
    if (symbolsToConnect.length === 0) {
        alert("No valid symbols entered.");
        return;
    }
    setActiveSymbols(symbolsToConnect);
    setIsLoading(true);
    setIsConnected(false);
    setFootprintBars({}); // Clear old data
    setCurrentPartialBars({});

    const url = `/api/footprint-stream?symbols=${symbolsToConnect.join(',')}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      console.log("SSE Connection Opened for symbols:", symbolsToConnect.join(','));
      setIsLoading(false);
      setIsConnected(true);
    };

    es.onerror = (error) => {
      console.error("SSE Error:", error);
      setIsLoading(false);
      setIsConnected(false);
      es.close();
    };

    es.addEventListener('footprintUpdate', (event) => {
      const barData = JSON.parse(event.data) as FootprintBar;
      setFootprintBars(prev => {
        const existingBars = prev[barData.symbol] || [];
        // Add new bar, ensuring no duplicates by timestamp, keeping it sorted by time, and limiting length
        const updatedBars = [
            ...existingBars.filter(b => b.timestamp !== barData.timestamp),
            barData
        ].sort((a,b) => b.timestamp - a.timestamp).slice(0, 10); // Keep last 10 bars, newest first
        return { ...prev, [barData.symbol]: updatedBars };
      });
      // Clear partial bar for this symbol when a full new bar arrives
      setCurrentPartialBars(prev => ({...prev, [barData.symbol]: {}}));
    });
    
    es.addEventListener('footprintUpdatePartial', (event) => {
        const partialBarData = JSON.parse(event.data) as Partial<FootprintBar>;
        if(partialBarData.symbol) {
            setCurrentPartialBars(prev => ({...prev, [partialBarData.symbol!]: partialBarData }));
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
    console.log("SSE Connection Closed by user.");
  };
  
  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
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
            Connected to stream for: {activeSymbols.join(', ')}. Displaying latest completed bar data. Partial current bar updates in console.
         </div>
        )}
       {!isConnected && !isLoading && activeSymbols.length > 0 && (
         <div className="text-sm text-red-600 dark:text-red-400">
            Disconnected from stream. Last tracked symbols: {activeSymbols.join(', ')}.
         </div>
       )}


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              {isLoading && !footprintBars[symbol]?.length ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-2 text-muted-foreground">Waiting for data...</p>
                </div>
              ) : (
                <>
                  {/* Display current partial bar if available */}
                  {currentPartialBars[symbol] && Object.keys(currentPartialBars[symbol]).length > 0 && (
                    <div className="mb-4 p-3 border border-dashed rounded-md bg-primary/5">
                      <p className="text-sm font-semibold text-primary mb-1">Current Aggregating Bar (Partial):</p>
                      <p className="text-xs">Timestamp: {currentPartialBars[symbol].timestamp ? new Date(currentPartialBars[symbol].timestamp!).toISOString() : 'N/A'}</p>
                      <p className="text-xs">O: {currentPartialBars[symbol].open?.toFixed(2)} H: {currentPartialBars[symbol].high?.toFixed(2)} L: {currentPartialBars[symbol].low?.toFixed(2)} C: {currentPartialBars[symbol].close?.toFixed(2)}</p>
                      <p className="text-xs">Volume: {currentPartialBars[symbol].totalVolume?.toFixed(2)} Delta: {currentPartialBars[symbol].delta?.toFixed(2)}</p>
                      <p className="text-xs">Price Levels Seen: {currentPartialBars[symbol].priceLevels?.size || 0}</p>
                    </div>
                  )}
                  {(footprintBars[symbol] && footprintBars[symbol].length > 0) ? (
                     footprintBars[symbol].map(bar => (
                       <div key={bar.timestamp} className="mb-3 last:mb-0">
                         <h4 className="font-medium text-sm mb-1">
                           Bar: {new Date(bar.timestamp).toLocaleTimeString()} - {new Date(bar.timestamp + 60000 -1).toLocaleTimeString()}
                         </h4>
                         <p className="text-xs text-muted-foreground">
                            O:{bar.open.toFixed(2)} H:{bar.high.toFixed(2)} L:{bar.low.toFixed(2)} C:{bar.close.toFixed(2)} Vol:{bar.totalVolume.toFixed(2)} Delta:{bar.delta.toFixed(2)}
                         </p>
                         <SimpleFootprintBarDisplay bar={bar} />
                       </div>
                     ))
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No complete bar data received yet for {symbol}.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
        {activeSymbols.length === 0 && !isLoading && (
            <Card className="md:col-span-2 lg:col-span-3">
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
