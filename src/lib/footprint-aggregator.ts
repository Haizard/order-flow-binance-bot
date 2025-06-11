
/**
 * @fileOverview Handles WebSocket connection to Binance for trade streams
 * and aggregates data into FootprintBar structures.
 */

import WebSocket from 'ws';
import type { FootprintTrade, FootprintBar, PriceLevelData, BinanceTradeData, BinanceStreamData } from '@/types/footprint';
import { MONITORED_MARKET_SYMBOLS } from '@/config/bot-strategy'; // Or a dynamic list

const BINANCE_FUTURES_WEBSOCKET_URL = 'wss://fstream.binance.com/stream';
const AGGREGATION_INTERVAL_MS = 60 * 1000; // 1 minute

const footprintDataStore = new Map<string, FootprintBar[]>();
// Store partial bar data, closer to the final FootprintBar structure
const currentBarData = new Map<string, Partial<FootprintBar>>();

let wsInstance: WebSocket | null = null;
let activeSymbols: string[] = [];
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_BASE = 1000; // 1 second

type ListenerCallback = (data: FootprintBar) => void;
const listeners = new Set<ListenerCallback>();

export function addFootprintListener(callback: ListenerCallback) {
  listeners.add(callback);
}
export function removeFootprintListener(callback: ListenerCallback) {
  listeners.delete(callback);
}
function notifyListeners(data: FootprintBar) {
  listeners.forEach(listener => listener(data));
}

// initializeNewBar now returns Partial<FootprintBar> and initializes tradesInBar
function initializeNewBar(symbol: string, timestamp: number, firstTradePrice: number): Partial<FootprintBar> {
  return {
    symbol: symbol,
    timestamp: timestamp,
    open: firstTradePrice,
    high: firstTradePrice,
    low: firstTradePrice,
    close: firstTradePrice, // Will be updated by the first actual trade processing
    totalVolume: 0,
    delta: 0,
    bidVolume: 0,
    askVolume: 0,
    priceLevels: new Map<string, PriceLevelData>(),
    tradesInBar: [], // Initialize as empty, first trade added in processTrade
  };
}

function processTrade(symbol: string, tradeData: BinanceTradeData) {
  const tradeTime = tradeData.T;
  const barTimestamp = Math.floor(tradeTime / AGGREGATION_INTERVAL_MS) * AGGREGATION_INTERVAL_MS;

  const parsedPrice = parseFloat(tradeData.p);
  const parsedQuantity = parseFloat(tradeData.q);

  if (isNaN(parsedPrice) || isNaN(parsedQuantity)) {
    console.warn(`[${new Date().toISOString()}] FootprintAggregator: Invalid price or quantity for trade ${tradeData.t} on ${symbol}. Price: ${tradeData.p}, Qty: ${tradeData.q}`);
    return;
  }

  const currentTrade: FootprintTrade = {
    id: tradeData.t,
    time: tradeTime,
    price: parsedPrice,
    volume: parsedQuantity,
    side: tradeData.m ? 'sell' : 'buy',
  };

  let bar = currentBarData.get(symbol);

  if (!bar || bar.timestamp !== barTimestamp) {
    if (bar && bar.timestamp && bar.totalVolume && bar.totalVolume > 0) {
      // console.log(`[${new Date().toISOString()}] FootprintAggregator [${symbol}]: Finalizing old bar at ${bar.timestamp} before creating new one at ${barTimestamp}. Old bar totalVolume: ${bar.totalVolume}`);
      const completedBar = finalizeBar(bar as FootprintBar); // Cast to full FootprintBar for finalization
      if(completedBar.totalVolume > 0) {
        const symbolBars = footprintDataStore.get(symbol) || [];
        symbolBars.push(completedBar);
        footprintDataStore.set(symbol, symbolBars.slice(-100)); // Keep last 100 bars
        notifyListeners(completedBar);
      }
    }
    // Initialize new bar structure using the current trade's price as the open
    bar = initializeNewBar(symbol, barTimestamp, currentTrade.price);
    currentBarData.set(symbol, bar);
  }

  // Ensure tradesInBar array exists and push current trade
  if (!bar.tradesInBar) bar.tradesInBar = []; // Should be initialized by initializeNewBar
  bar.tradesInBar.push(currentTrade);

  bar.high = Math.max(bar.high ?? currentTrade.price, currentTrade.price);
  bar.low = Math.min(bar.low ?? currentTrade.price, currentTrade.price);
  bar.close = currentTrade.price;
  bar.totalVolume = (bar.totalVolume ?? 0) + currentTrade.volume;

  const priceLevelStr = currentTrade.price.toFixed(5); // Increased precision

  // Direct access to priceLevels map
  const currentBarPriceLevels = bar.priceLevels;
  if (!currentBarPriceLevels) {
    // This case should ideally not be hit if initializeNewBar works correctly
    console.error(`[${new Date().toISOString()}] FootprintAggregator [${symbol}]: CRITICAL - bar.priceLevels is undefined for bar at ${bar.timestamp}. Re-initializing.`);
    bar.priceLevels = new Map<string, PriceLevelData>();
    // return; // Or handle error more gracefully, for now, we re-initialize and proceed
  }
  
  const priceLevelData = bar.priceLevels.get(priceLevelStr) || { buyVolume: 0, sellVolume: 0 };

  if (currentTrade.side === 'buy') {
    bar.askVolume = (bar.askVolume ?? 0) + currentTrade.volume;
    priceLevelData.buyVolume += currentTrade.volume;
  } else {
    bar.bidVolume = (bar.bidVolume ?? 0) + currentTrade.volume;
    priceLevelData.sellVolume += currentTrade.volume;
  }
  bar.priceLevels.set(priceLevelStr, priceLevelData);

  // console.log(`[${new Date().toISOString()}] FootprintAggregator [${symbol}]: processTrade updated priceLevels. Size: ${bar.priceLevels.size}, Last Key: ${priceLevelStr}, Value: ${JSON.stringify(priceLevelData)}, Side: ${currentTrade.side}, Vol: ${currentTrade.volume}`);
  
  bar.delta = (bar.askVolume ?? 0) - (bar.bidVolume ?? 0);
}

function finalizeBar(barToFinalize: FootprintBar): FootprintBar {
  const logTimestamp = new Date().toISOString();
  // Ensure all fields are present as per FootprintBar, using defaults if partial bar fields were undefined
  const finalOpen = barToFinalize.open ?? 0;
  const finalHigh = barToFinalize.high ?? 0;
  const finalLow = barToFinalize.low ?? 0;
  const finalClose = barToFinalize.close ?? 0;
  const finalTotalVolume = barToFinalize.totalVolume ?? 0;
  const finalDelta = barToFinalize.delta ?? 0;
  const finalBidVolume = barToFinalize.bidVolume ?? 0;
  const finalAskVolume = barToFinalize.askVolume ?? 0;
  const finalPriceLevels = barToFinalize.priceLevels || new Map<string, PriceLevelData>();
  const finalTradesInBar = barToFinalize.tradesInBar || [];

  if (finalPriceLevels.size > 0) {
    console.log(`[${logTimestamp}] FootprintAggregator [${barToFinalize.symbol}]: Finalizing bar for ${new Date(barToFinalize.timestamp).toISOString()}. priceLevels size: ${finalPriceLevels.size}. Keys: ${Array.from(finalPriceLevels.keys()).join(', ')}`);
  } else {
    console.log(`[${logTimestamp}] FootprintAggregator [${barToFinalize.symbol}]: Finalizing bar for ${new Date(barToFinalize.timestamp).toISOString()}. priceLevels is empty or was undefined.`);
  }
  
  return {
    symbol: barToFinalize.symbol,
    timestamp: barToFinalize.timestamp,
    open: finalOpen,
    high: finalHigh,
    low: finalLow,
    close: finalClose,
    totalVolume: finalTotalVolume,
    delta: finalDelta,
    bidVolume: finalBidVolume,
    askVolume: finalAskVolume,
    priceLevels: finalPriceLevels,
    tradesInBar: finalTradesInBar,
  };
}


function connect() {
  if (wsInstance && (wsInstance.readyState === WebSocket.OPEN || wsInstance.readyState === WebSocket.CONNECTING)) {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: WebSocket already open or connecting.`);
    return;
  }

  const streams = activeSymbols.map(s => `${s.toLowerCase()}@trade`).join('/');
  if (!streams) {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: No active symbols to connect.`);
    return;
  }
  const url = `${BINANCE_FUTURES_WEBSOCKET_URL}?streams=${streams}`;
  console.log(`[${new Date().toISOString()}] FootprintAggregator: Connecting to ${url}`);

  wsInstance = new WebSocket(url);

  wsInstance.on('open', () => {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: WebSocket connection established for symbols: ${activeSymbols.join(', ')}.`);
    reconnectAttempts = 0;
  });

  wsInstance.on('message', (data: WebSocket.Data) => {
    try {
      const message: BinanceStreamData = JSON.parse(data.toString());
      if (message.data && message.data.s) { // Standard message structure with data.s
        processTrade(message.data.s, message.data);
      } else if (message.stream && message.data) { // Multiplexed stream with data field
         const symbolFromStream = message.stream.split('@')[0].toUpperCase();
         processTrade(symbolFromStream, message.data);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] FootprintAggregator: Error processing message:`, error, data.toString());
    }
  });

  wsInstance.on('error', (error: Error) => {
    console.error(`[${new Date().toISOString()}] FootprintAggregator: WebSocket error:`, error.message);
  });

  wsInstance.on('close', (code: number, reason: Buffer) => {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: WebSocket connection closed. Code: ${code}, Reason: ${reason.toString()}. Attempting to reconnect...`);
    wsInstance = null;
    attemptReconnect();
  });

  wsInstance.on('ping', () => {
    wsInstance?.pong();
  });
}

function attemptReconnect() {
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    const delay = Math.pow(2, reconnectAttempts -1 ) * RECONNECT_DELAY_BASE;
    console.log(`[${new Date().toISOString()}] FootprintAggregator: Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s.`);
    setTimeout(() => {
      if (activeSymbols.length > 0) {
        connect();
      } else {
        console.log(`[${new Date().toISOString()}] FootprintAggregator: No active symbols, stopping reconnection attempts.`);
        reconnectAttempts = 0; // Reset attempts if no symbols to track
      }
    }, delay);
  } else {
    console.error(`[${new Date().toISOString()}] FootprintAggregator: Maximum reconnect attempts reached. Please check the connection or symbol list.`);
    // Do not reset reconnectAttempts here, so it won't try again until explicitly started
  }
}

export function startFootprintStream(symbols: string[] = MONITORED_MARKET_SYMBOLS) {
  console.log(`[${new Date().toISOString()}] FootprintAggregator: startFootprintStream called with symbols: ${symbols.join(', ')}`);
  const newSymbols = symbols.filter(s => !activeSymbols.includes(s.toUpperCase()));
  const symbolsToKeep = activeSymbols.filter(s => symbols.map(sy => sy.toUpperCase()).includes(s));
  
  const finalSymbolList = [...new Set([...symbolsToKeep, ...newSymbols.map(s => s.toUpperCase())])];

  if (JSON.stringify(activeSymbols.sort()) !== JSON.stringify(finalSymbolList.sort())) {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: Symbol list changing from [${activeSymbols.join(',')}] to [${finalSymbolList.join(',')}].`);
    activeSymbols = finalSymbolList;
    reconnectAttempts = 0; // Reset reconnect attempts for a fresh connection attempt with new/updated symbols
    if (wsInstance) {
      console.log(`[${new Date().toISOString()}] FootprintAggregator: Closing existing WebSocket due to symbol change.`);
      wsInstance.close(); // Will trigger attemptReconnect which uses the new activeSymbols
    } else if (activeSymbols.length > 0) {
      connect();
    }
  } else if (!wsInstance && activeSymbols.length > 0) {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: No WebSocket instance, but active symbols present. Connecting.`);
    reconnectAttempts = 0;
    connect();
  } else if (activeSymbols.length === 0 && wsInstance) {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: No active symbols. Closing WebSocket.`);
    wsInstance.close();
    wsInstance = null;
  } else {
     console.log(`[${new Date().toISOString()}] FootprintAggregator: No change in symbols or WebSocket state requiring action. Current symbols: ${activeSymbols.join(',')}`);
  }
}

export function stopFootprintStream() {
  console.log(`[${new Date().toISOString()}] FootprintAggregator: stopFootprintStream called.`);
  if (wsInstance) {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: Closing WebSocket connection explicitly.`);
    const oldActiveSymbols = [...activeSymbols];
    activeSymbols = []; // Clear active symbols first
    reconnectAttempts = MAX_RECONNECT_ATTEMPTS + 1; // Prevent auto-reconnect
    wsInstance.close();
    wsInstance = null;
    console.log(`[${new Date().toISOString()}] FootprintAggregator: Stopped stream for ${oldActiveSymbols.join(', ')}.`);
    // Reset reconnectAttempts after a short delay so future start calls work
    setTimeout(()=> { reconnectAttempts = 0; }, RECONNECT_DELAY_BASE * 2);
  } else {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: No active WebSocket stream to stop.`);
    activeSymbols = []; // Ensure active symbols are cleared
    reconnectAttempts = 0; // Ensure it's reset for next start
  }
  currentBarData.clear();
}

// Changed return type to Partial<FootprintBar>
export function getCurrentAggregatingBar(symbol: string): Partial<FootprintBar> | undefined {
    return currentBarData.get(symbol);
}

// Initial log to confirm module is loaded.
console.log(`[${new Date().toISOString()}] FootprintAggregator: Module loaded. Call startFootprintStream() via API to begin data aggregation.`);
// NOTE: Actual WebSocket connection is only initiated when startFootprintStream is called and there are active symbols.
// Removed automatic start on module load.
