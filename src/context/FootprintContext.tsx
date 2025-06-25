
'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import type { FootprintBar, PriceLevelData } from '@/types/footprint';
import { useToast } from "@/hooks/use-toast";

const AGGREGATION_INTERVAL_MS = 60 * 1000; // 1 minute

interface FootprintContextState {
  footprintBars: Record<string, FootprintBar[]>;
  currentPartialBars: Record<string, Partial<FootprintBar>>;
  isConnected: boolean;
  isLoading: boolean;
  activeSymbols: string[];
  connect: (symbols: string[]) => void;
  disconnect: () => void;
}

const FootprintContext = createContext<FootprintContextState | undefined>(undefined);

export function FootprintProvider({ children }: { children: ReactNode }) {
  const [footprintBars, setFootprintBars] = useState<Record<string, FootprintBar[]>>({});
  const [currentPartialBars, setCurrentPartialBars] = useState<Record<string, Partial<FootprintBar>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [activeSymbols, setActiveSymbols] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { toast } = useToast();

  // Ref to hold the latest state for use in callbacks without triggering re-renders of the callback itself.
  const stateRef = useRef({ isLoading, isConnected, activeSymbols });
  useEffect(() => {
    stateRef.current = { isLoading, isConnected, activeSymbols };
  }, [isLoading, isConnected, activeSymbols]);


  const handleDisconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
    setIsLoading(false);
    // Don't clear active symbols so we know what to reconnect to if needed
  }, []);

  const disconnect = useCallback(() => {
    handleDisconnect();
    setActiveSymbols([]); // Clear symbols on manual disconnect
    toast({
      title: "Stream Disconnected",
      description: "You have manually disconnected from the footprint data stream.",
      variant: "default",
    });
  }, [handleDisconnect, toast]);

  const connect = useCallback((symbolsToConnect: string[]) => {
    // Read the latest state from the ref to avoid dependency loops.
    const { isLoading: currentIsLoading, isConnected: currentIsConnected, activeSymbols: currentActiveSymbols } = stateRef.current;
    
    if (currentIsLoading || (currentIsConnected && JSON.stringify(symbolsToConnect.sort()) === JSON.stringify(currentActiveSymbols.sort()))) {
      return; // Already connecting or connected to the same symbols
    }

    handleDisconnect(); // Disconnect from any previous stream

    if (symbolsToConnect.length === 0) {
      toast({
        title: "No Symbols Provided",
        description: "Cannot connect to the stream without symbols.",
        variant: "destructive"
      });
      return;
    }

    setActiveSymbols(symbolsToConnect);
    setIsLoading(true);
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

    es.onerror = () => {
      console.error("Client-side EventSource connection error.");
      toast({
        title: "Stream Connection Error",
        description: "Lost connection to data stream. It might auto-reconnect, or you may need to manually reconnect.",
        variant: "destructive",
      });
      setIsLoading(false);
      setIsConnected(false);
      // Do not clear eventSourceRef here, browser will handle reconnect logic.
    };

    es.addEventListener('footprintUpdate', (event) => {
      const rawData = JSON.parse(event.data);
      const reconstructedPriceLevels = rawData.priceLevels && typeof rawData.priceLevels === 'object'
        ? new Map<string, PriceLevelData>(Object.entries(rawData.priceLevels))
        : new Map<string, PriceLevelData>();

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
        ].sort((a, b) => b.timestamp - a.timestamp);
        // Limit stored bars to prevent memory issues, e.g., 50 bars
        if (updatedBars.length > 50) {
            updatedBars.slice(0, 50);
        }
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

      if (partialBarDataWithMap.symbol) {
        setCurrentPartialBars(prev => ({
          ...prev,
          [partialBarDataWithMap.symbol!]: partialBarDataWithMap,
        }));
      }
    });

  }, [handleDisconnect, toast]); // Dependency array is now stable

  useEffect(() => {
    // Cleanup on provider unmount (e.g., user logs out)
    return () => {
      handleDisconnect();
    };
  }, [handleDisconnect]);

  const value = {
    footprintBars,
    currentPartialBars,
    isConnected,
    isLoading,
    activeSymbols,
    connect,
    disconnect,
  };

  return <FootprintContext.Provider value={value}>{children}</FootprintContext.Provider>;
}

export function useFootprint() {
  const context = useContext(FootprintContext);
  if (context === undefined) {
    throw new Error('useFootprint must be used within a FootprintProvider');
  }
  return context;
}
