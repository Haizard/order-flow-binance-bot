
/**
 * @fileOverview Handles WebSocket connection to Binance for trade streams
 * and aggregates data into FootprintBar structures.
 */

import WebSocket from 'ws';
import type { FootprintTrade, FootprintBar, PriceLevelData, BinanceTradeData, BinanceStreamData } from '@/types/footprint';
import { MONITORED_MARKET_SYMBOLS } from '@/config/bot-strategy'; 

const BINANCE_FUTURES_WEBSOCKET_URL = 'wss://fstream.binance.com/stream';
const AGGREGATION_INTERVAL_MS = 60 * 1000; // 1 minute

const footprintDataStore = new Map<string, FootprintBar[]>();
const currentBarData = new Map<string, Partial<FootprintBar>>();

let wsInstance: WebSocket | null = null;
let activeSymbols: string[] = [];
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_BASE = 1000; // 1 second

type ListenerCallback = (data: FootprintBar | Partial<FootprintBar>, eventType: 'footprintUpdate' | 'footprintUpdatePartial') => void;
const listeners = new Set<ListenerCallback>();

export function addFootprintListener(callback: ListenerCallback) {
  listeners.add(callback);
}
export function removeFootprintListener(callback: ListenerCallback) {
  listeners.delete(callback);
}
function notifyListeners(data: FootprintBar | Partial<FootprintBar>, eventType: 'footprintUpdate' | 'footprintUpdatePartial') {
  listeners.forEach(listener => listener(data, eventType));
}

function initializeNewBar(symbol: string, timestamp: number): Partial<FootprintBar> {
  // console.log(`[${new Date().toISOString()}] FootprintAggregator [${symbol}]: Initializing new partial bar at ${timestamp}.`);
  return {
    symbol: symbol,
    timestamp: timestamp,
    open: undefined,
    high: undefined,
    low: undefined,
    close: undefined,
    totalVolume: 0,
    delta: 0,
    bidVolume: 0,
    askVolume: 0,
    priceLevels: new Map<string, PriceLevelData>(),
    tradesInBar: [],
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
      const completedBar = finalizeBar(bar as FootprintBar); 
      if(completedBar.totalVolume > 0) {
        const symbolBars = footprintDataStore.get(symbol) || [];
        symbolBars.push(completedBar);
        footprintDataStore.set(symbol, symbolBars.slice(-100));
        
        const logTimestampFinal = new Date().toISOString();
        console.log(`[${logTimestampFinal}] FootprintAggregator [${symbol}]: NOTIFYING 'footprintUpdate'. Bar TS: ${completedBar.timestamp}, PriceLevels Size: ${completedBar.priceLevels.size}`);
        if (completedBar.priceLevels.size > 0) {
            console.log(`[${logTimestampFinal}] FootprintAggregator [${symbol}]: Keys for completed: ${Array.from(completedBar.priceLevels.keys()).join(', ')}`);
        }
        notifyListeners(completedBar, 'footprintUpdate');
      }
    }
    bar = initializeNewBar(symbol, barTimestamp);
    currentBarData.set(symbol, bar);
  }

  if (!bar.priceLevels) { // Should ideally not happen due to initializeNewBar
    console.error(`[${new Date().toISOString()}] FootprintAggregator [${symbol}]: CRITICAL - bar.priceLevels is undefined for bar at ${bar.timestamp}. Re-initializing.`);
    bar.priceLevels = new Map<string, PriceLevelData>();
  }
  if (!bar.tradesInBar) { // Should ideally not happen
     bar.tradesInBar = [];
  }
   if (bar.open === undefined) bar.open = currentTrade.price;
   if (bar.high === undefined) bar.high = currentTrade.price; else bar.high = Math.max(bar.high, currentTrade.price);
   if (bar.low === undefined) bar.low = currentTrade.price; else bar.low = Math.min(bar.low, currentTrade.price);
  
  bar.close = currentTrade.price;
  bar.totalVolume = (bar.totalVolume ?? 0) + currentTrade.volume;
  bar.tradesInBar.push(currentTrade);
  
  const priceLevelStr = currentTrade.price.toFixed(5); 
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
  currentBarData.set(symbol, bar); 

  const logTimestampPartial = new Date().toISOString();
  console.log(`[${logTimestampPartial}] FootprintAggregator [${symbol}]: NOTIFYING 'footprintUpdatePartial'. Bar TS: ${bar.timestamp}, PriceLevels Size: ${bar.priceLevels?.size}`);
  if (bar.priceLevels && bar.priceLevels.size > 0) {
    console.log(`[${logTimestampPartial}] FootprintAggregator [${symbol}]: Keys for partial: ${Array.from(bar.priceLevels.keys()).join(', ')}`);
  }
  notifyListeners(bar, 'footprintUpdatePartial');
}

function finalizeBar(barToFinalize: Partial<FootprintBar>): FootprintBar {
  const logTimestamp = new Date().toISOString();
  if (barToFinalize.priceLevels && barToFinalize.priceLevels.size > 0) {
    // console.log(`[${logTimestamp}] FootprintAggregator [${barToFinalize.symbol}]: Finalizing bar for ${new Date(barToFinalize.timestamp!).toISOString()}. priceLevels size: ${barToFinalize.priceLevels.size}. Keys: ${Array.from(barToFinalize.priceLevels.keys()).join(', ')}`);
  } else {
    // console.log(`[${logTimestamp}] FootprintAggregator [${barToFinalize.symbol}]: Finalizing bar for ${new Date(barToFinalize.timestamp!).toISOString()}. priceLevels is empty or was undefined.`);
  }
  
  return {
    symbol: barToFinalize.symbol!,
    timestamp: barToFinalize.timestamp!,
    open: barToFinalize.open ?? 0,
    high: barToFinalize.high ?? 0,
    low: barToFinalize.low ?? 0,
    close: barToFinalize.close ?? 0,
    totalVolume: barToFinalize.totalVolume ?? 0,
    delta: barToFinalize.delta ?? 0,
    bidVolume: barToFinalize.bidVolume ?? 0,
    askVolume: barToFinalize.askVolume ?? 0,
    priceLevels: barToFinalize.priceLevels || new Map<string, PriceLevelData>(),
    tradesInBar: barToFinalize.tradesInBar || [],
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
       if (message.stream && message.data && message.data.s) { 
         const symbolFromStream = message.stream.split('@')[0].toUpperCase();
         processTrade(symbolFromStream, message.data);
      } else {
        console.warn(`[${new Date().toISOString()}] FootprintAggregator: Received unexpected message format:`, data.toString().substring(0,100));
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
    if (activeSymbols.length > 0) { 
        attemptReconnect();
    } else {
        console.log(`[${new Date().toISOString()}] FootprintAggregator: No active symbols, will not reconnect automatically.`);
        reconnectAttempts = 0; 
    }
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
        reconnectAttempts = 0; 
      }
    }, delay);
  } else {
    console.error(`[${new Date().toISOString()}] FootprintAggregator: Maximum reconnect attempts reached. Please check the connection or symbol list.`);
  }
}

export function startFootprintStream(symbols: string[] = MONITORED_MARKET_SYMBOLS) {
  console.log(`[${new Date().toISOString()}] FootprintAggregator: startFootprintStream called with symbols: ${symbols.join(', ')}`);
  const newSymbols = symbols.filter(s => !activeSymbols.includes(s.toUpperCase()));
  const symbolsToKeep = activeSymbols.filter(s => symbols.map(sy => sy.toUpperCase()).includes(s));
  
  const finalSymbolList = [...new Set([...symbolsToKeep, ...newSymbols.map(s => s.toUpperCase())])].filter(s => s.trim() !== '');


  if (JSON.stringify(activeSymbols.sort()) !== JSON.stringify(finalSymbolList.sort()) || (!wsInstance && finalSymbolList.length > 0)) {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: Symbol list changing from [${activeSymbols.join(',')}] to [${finalSymbolList.join(',')}], or WS needs to start.`);
    activeSymbols = finalSymbolList;
    
    if (wsInstance) {
      console.log(`[${new Date().toISOString()}] FootprintAggregator: Closing existing WebSocket due to symbol change or to restart.`);
      reconnectAttempts = 0; 
      wsInstance.close(); 
    }
    
    if (activeSymbols.length > 0) {
      if (!wsInstance) { 
        console.log(`[${new Date().toISOString()}] FootprintAggregator: No WebSocket instance or instance closed. Connecting with new symbols.`);
        reconnectAttempts = 0;
        connect();
      }
    } else if (wsInstance) { 
        console.log(`[${new Date().toISOString()}] FootprintAggregator: No active symbols. Closing WebSocket.`);
        wsInstance.close();
        wsInstance = null;
        reconnectAttempts = 0;
    }

  } else if (activeSymbols.length === 0 && wsInstance) {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: No active symbols. Closing WebSocket.`);
    wsInstance.close();
    wsInstance = null;
    reconnectAttempts = 0;
  } else {
     console.log(`[${new Date().toISOString()}] FootprintAggregator: No change in symbols or WebSocket state requiring action. Current symbols: ${activeSymbols.join(',')}`);
  }
}

export function stopFootprintStream() {
  console.log(`[${new Date().toISOString()}] FootprintAggregator: stopFootprintStream called.`);
  if (wsInstance) {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: Closing WebSocket connection explicitly.`);
    const oldActiveSymbols = [...activeSymbols];
    activeSymbols = []; 
    const tempWsInstance = wsInstance; // Store instance to ensure close is called on the correct one
    wsInstance = null; // Set to null before calling close to prevent immediate reconnect attempts from 'close' handler
    reconnectAttempts = MAX_RECONNECT_ATTEMPTS + 1; // Prevent automatic reconnection during explicit stop
    tempWsInstance.close();
    console.log(`[${new Date().toISOString()}] FootprintAggregator: Stopped stream for ${oldActiveSymbols.join(', ')}.`);
    setTimeout(()=> { 
        if (!wsInstance) reconnectAttempts = 0; // Reset if still no wsInstance (meaning it wasn't restarted by another call)
    }, RECONNECT_DELAY_BASE * 2);
  } else {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: No active WebSocket stream to stop.`);
    activeSymbols = []; 
    reconnectAttempts = 0; 
  }
  currentBarData.clear();
}

export function getLatestFootprintBars(symbol: string, count: number): FootprintBar[] {
  const bars = footprintDataStore.get(symbol.toUpperCase()) || [];
  return bars.slice(-count);
}

export async function getCurrentAggregatingBar(symbol: string): Promise<Partial<FootprintBar> | undefined> {
    return currentBarData.get(symbol.toUpperCase());
}

console.log(`[${new Date().toISOString()}] FootprintAggregator: Module loaded. Call startFootprintStream() via API to begin data aggregation.`);

    
