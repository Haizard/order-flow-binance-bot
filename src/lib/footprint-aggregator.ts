
/**
 * @fileOverview Handles WebSocket connection to Binance for trade streams
 * and aggregates data into FootprintBar structures.
 */

import WebSocket from 'ws';
import type { FootprintTrade, FootprintBar, PriceLevelData, BinanceTradeData, BinanceStreamData } from '@/types/footprint';
import { MONITORED_MARKET_SYMBOLS } from '@/config/bot-strategy';

const BINANCE_FUTURES_WEBSOCKET_URL = 'wss://fstream.binance.com/stream';
const AGGREGATION_INTERVAL_MS = 60 * 1000; // 1 minute

const footprintDataStore = new Map<string, FootprintBar[]>(); // Stores arrays of completed bars
const currentBarData = new Map<string, Partial<FootprintBar>>(); // Stores the currently aggregating bar

let wsInstance: WebSocket | null = null;
let activeSymbols: string[] = [];
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_BASE = 1000; // 1 second
let pingTimeout: NodeJS.Timeout | null = null;
let keepAliveIntervalId: NodeJS.Timeout | null = null;


type ListenerCallback = (data: FootprintBar | Partial<FootprintBar>, eventType: 'footprintUpdate' | 'footprintUpdatePartial') => void;
const listeners = new Set<ListenerCallback>();

export function addFootprintListener(callback: ListenerCallback) {
  listeners.add(callback);
}
export function removeFootprintListener(callback: ListenerCallback) {
  listeners.delete(callback);
}
function notifyListeners(data: FootprintBar | Partial<FootprintBar>, eventType: 'footprintUpdate' | 'footprintUpdatePartial') {
  const logTimestamp = new Date().toISOString();
  const symbol = 'symbol' in data ? data.symbol : 'N/A';
  const priceLevelsSize = data.priceLevels instanceof Map ? data.priceLevels.size : (typeof data.priceLevels === 'object' ? Object.keys(data.priceLevels).length : 'N/A');
  const priceLevelKeys = data.priceLevels instanceof Map && data.priceLevels.size > 0 ? Array.from(data.priceLevels.keys()).join(', ') : "None";
  
  // console.log(`[${logTimestamp}] FootprintAggregator [${symbol}]: NOTIFYING '${eventType}'. Bar TS: ${data.timestamp}, PriceLevels Size: ${priceLevelsSize}, Keys: ${priceLevelKeys}`);
  
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

  if (isNaN(parsedPrice) || parsedPrice <= 0 || isNaN(parsedQuantity) || parsedQuantity <= 0) {
    console.warn(`[${new Date().toISOString()}] FootprintAggregator [${symbol}]: Invalid price or quantity for trade ${tradeData.t}. Price: ${tradeData.p}, Qty: ${tradeData.q}. Skipping trade.`);
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
      if (completedBar.totalVolume > 0) {
        const symbolBars = footprintDataStore.get(symbol) || [];
        symbolBars.push(completedBar);
        footprintDataStore.set(symbol, symbolBars.slice(-100)); // Keep last 100 bars
        notifyListeners(completedBar, 'footprintUpdate');
      }
    }
    bar = initializeNewBar(symbol, barTimestamp);
    currentBarData.set(symbol, bar);
  }
  
  if (!bar.priceLevels) { 
    console.error(`[${new Date().toISOString()}] FootprintAggregator [${symbol}]: CRITICAL - bar.priceLevels is undefined for bar at ${bar.timestamp}. Re-initializing.`);
    bar.priceLevels = new Map<string, PriceLevelData>();
  }
  if (!bar.tradesInBar) { 
     bar.tradesInBar = [];
  }

  // Update OHLC
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
  // const processTradeLogTs = new Date().toISOString();
  // console.log(`[${processTradeLogTs}] FootprintAggregator [${symbol}]: processTrade updated priceLevels. Size: ${bar.priceLevels.size}, Last Key: ${priceLevelStr}, Value: ${JSON.stringify(priceLevelData)}, Side: ${currentTrade.side}, Vol: ${currentTrade.volume}`);

  bar.delta = (bar.askVolume ?? 0) - (bar.bidVolume ?? 0);
  currentBarData.set(symbol, bar);
  notifyListeners(bar, 'footprintUpdatePartial');
}

function finalizeBar(barToFinalize: Partial<FootprintBar>): FootprintBar {
  // const logTimestamp = new Date().toISOString();
  // if (barToFinalize.priceLevels && barToFinalize.priceLevels.size > 0) {
  //   console.log(`[${logTimestamp}] FootprintAggregator [${barToFinalize.symbol}]: Finalizing bar for ${new Date(barToFinalize.timestamp!).toISOString()}. priceLevels size: ${barToFinalize.priceLevels.size}. Keys: ${Array.from(barToFinalize.priceLevels.keys()).join(', ')}`);
  // } else {
  //   console.log(`[${logTimestamp}] FootprintAggregator [${barToFinalize.symbol}]: Finalizing bar for ${new Date(barToFinalize.timestamp!).toISOString()}. priceLevels is empty.`);
  // }
  
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

function heartbeat() {
  if (pingTimeout) clearTimeout(pingTimeout);
  pingTimeout = setTimeout(() => {
    if (wsInstance) {
      console.log(`[${new Date().toISOString()}] FootprintAggregator: WebSocket ping timeout, terminating connection.`);
      wsInstance.terminate(); // Force close if pong not received
    }
  }, 30000 + 1000); // Binance sends pings every 3 minutes. We expect pong within 30s.
}


function connect() {
  if (wsInstance && (wsInstance.readyState === WebSocket.OPEN || wsInstance.readyState === WebSocket.CONNECTING)) {
    // console.log(`[${new Date().toISOString()}] FootprintAggregator: WebSocket already open or connecting.`);
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
  heartbeat(); // Start heartbeat on new connection attempt

  wsInstance.on('open', () => {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: WebSocket connection established for symbols: ${activeSymbols.join(', ')}.`);
    reconnectAttempts = 0;
    heartbeat(); // Reset heartbeat on open

    if (keepAliveIntervalId) clearInterval(keepAliveIntervalId);
    keepAliveIntervalId = setInterval(() => {
      if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
        // console.log(`[${new Date().toISOString()}] FootprintAggregator: Sending ping to WebSocket.`);
        wsInstance.ping();
      }
    }, 3 * 60 * 1000); // Send a ping every 3 minutes
  });

  wsInstance.on('message', (data: WebSocket.Data) => {
    try {
      const message: BinanceStreamData = JSON.parse(data.toString());
      if (message.stream && message.data && message.data.s) {
        const symbolFromStream = message.stream.split('@')[0].toUpperCase();
        processTrade(symbolFromStream, message.data);
      } else if (data.toString().includes("ping")) { // Handle textual ping if any
        wsInstance?.pong();
      } else if (data.toString().includes("pong")) { // Handle textual pong if any
         heartbeat(); // Reset heartbeat on pong
      }
      else {
        // console.warn(`[${new Date().toISOString()}] FootprintAggregator: Received unexpected message format:`, data.toString().substring(0, 100));
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] FootprintAggregator: Error processing message:`, error, data.toString());
    }
  });

  wsInstance.on('ping', () => {
    // console.log(`[${new Date().toISOString()}] FootprintAggregator: Received ping from server.`);
    heartbeat(); // Reset heartbeat on server ping
    wsInstance?.pong();
  });

  wsInstance.on('pong', () => {
    // console.log(`[${new Date().toISOString()}] FootprintAggregator: Received pong from server.`);
    heartbeat(); // Reset heartbeat on pong
  });

  wsInstance.on('error', (error: Error) => {
    console.error(`[${new Date().toISOString()}] FootprintAggregator: WebSocket error:`, error.message);
    // The 'close' event will usually follow, triggering reconnection logic
  });

  wsInstance.on('close', (code: number, reason: Buffer) => {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: WebSocket connection closed. Code: ${code}, Reason: ${reason.toString()}.`);
    if (pingTimeout) clearTimeout(pingTimeout);
    if (keepAliveIntervalId) clearInterval(keepAliveIntervalId);
    wsInstance = null;
    if (activeSymbols.length > 0 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) { // Only reconnect if intended
        attemptReconnect();
    } else if (activeSymbols.length === 0) {
        console.log(`[${new Date().toISOString()}] FootprintAggregator: No active symbols, will not reconnect automatically.`);
        reconnectAttempts = 0;
    } else {
        console.log(`[${new Date().toISOString()}] FootprintAggregator: Max reconnect attempts reached or reconnection not intended.`);
    }
  });
}

function attemptReconnect() {
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    const delay = Math.pow(2, reconnectAttempts - 1) * RECONNECT_DELAY_BASE;
    console.log(`[${new Date().toISOString()}] FootprintAggregator: Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s.`);
    setTimeout(() => {
      if (activeSymbols.length > 0) { // Double check if symbols are still active before reconnecting
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
  const newSymbols = symbols.filter(s => s.trim() !== '' && !activeSymbols.includes(s.toUpperCase()));
  const symbolsToKeep = activeSymbols.filter(s => symbols.map(sy => sy.toUpperCase()).includes(s));
  const finalSymbolList = [...new Set([...symbolsToKeep, ...newSymbols.map(s => s.toUpperCase())])];

  const oldSymbolsJSON = JSON.stringify(activeSymbols.sort());
  const newSymbolsJSON = JSON.stringify(finalSymbolList.sort());

  if (newSymbolsJSON !== oldSymbolsJSON || (!wsInstance && finalSymbolList.length > 0)) {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: Symbol list changing from [${activeSymbols.join(',')}] to [${finalSymbolList.join(',')}], or WS needs to start.`);
    activeSymbols = finalSymbolList;

    if (wsInstance) {
      console.log(`[${new Date().toISOString()}] FootprintAggregator: Closing existing WebSocket due to symbol change or restart.`);
      const tempWs = wsInstance;
      wsInstance = null; // Prevent close handler from immediate auto-reconnect with old symbols
      reconnectAttempts = MAX_RECONNECT_ATTEMPTS + 1; // Prevent reconnection attempts from this specific close
      tempWs.close();
      // Allow a short delay for the close to complete before trying to connect again
      setTimeout(() => {
        reconnectAttempts = 0; // Reset for the new connection
        if (activeSymbols.length > 0) connect();
      }, 500);
    } else if (activeSymbols.length > 0) {
      reconnectAttempts = 0; // Reset for a new connection
      connect();
    }
  } else if (activeSymbols.length === 0 && wsInstance) {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: No active symbols. Closing WebSocket.`);
    const tempWs = wsInstance;
    wsInstance = null;
    reconnectAttempts = MAX_RECONNECT_ATTEMPTS +1; // Prevent auto-reconnect
    tempWs.close();
    reconnectAttempts = 0; // Reset for future manual starts
  } else {
    // console.log(`[${new Date().toISOString()}] FootprintAggregator: No change in symbols or WebSocket state requiring action. Current symbols: ${activeSymbols.join(',')}`);
  }
}

export function stopFootprintStream() {
  console.log(`[${new Date().toISOString()}] FootprintAggregator: stopFootprintStream called.`);
  const oldActiveSymbols = [...activeSymbols];
  activeSymbols = []; // Clear active symbols first
  if (wsInstance) {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: Closing WebSocket connection explicitly.`);
    const tempWsInstance = wsInstance;
    wsInstance = null;
    reconnectAttempts = MAX_RECONNECT_ATTEMPTS + 1; // Prevent automatic reconnection
    tempWsInstance.close();
    console.log(`[${new Date().toISOString()}] FootprintAggregator: Stopped stream for ${oldActiveSymbols.join(', ')}.`);
    if (pingTimeout) clearTimeout(pingTimeout);
    if (keepAliveIntervalId) clearInterval(keepAliveIntervalId);
    // Reset reconnectAttempts after a short delay to ensure it's not immediately set back by a rapid close/reconnect cycle
    setTimeout(() => { 
        if (!wsInstance) reconnectAttempts = 0; 
    }, RECONNECT_DELAY_BASE * 2);
  } else {
    // console.log(`[${new Date().toISOString()}] FootprintAggregator: No active WebSocket stream to stop.`);
    reconnectAttempts = 0;
  }
  currentBarData.clear();
}

export function getLatestFootprintBars(symbol: string, count: number): FootprintBar[] {
  const bars = footprintDataStore.get(symbol.toUpperCase()) || [];
  return bars.slice(-count);
}

export function getCurrentAggregatingBar(symbol: string): Partial<FootprintBar> | undefined {
  return currentBarData.get(symbol.toUpperCase());
}

// console.log(`[${new Date().toISOString()}] FootprintAggregator: Module loaded. Call startFootprintStream() via API to begin data aggregation.`);
// Example: For server-side only testing:
// if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
//   startFootprintStream(['BTCUSDT', 'ETHUSDT']);
//   addFootprintListener((data, eventType) => {
//     console.log(`Listener received ${eventType} for ${data.symbol} at ${data.timestamp}`);
//   });
// }
    
