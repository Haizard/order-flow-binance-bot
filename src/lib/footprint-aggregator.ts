
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
const currentBarData = new Map<string, Partial<FootprintBar> & { trades: FootprintTrade[] }>();

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


function initializeNewBar(symbol: string, timestamp: number, firstTrade: FootprintTrade): Partial<FootprintBar> & { trades: FootprintTrade[] } {
  return {
    symbol: symbol,
    timestamp: timestamp,
    open: firstTrade.price,
    high: firstTrade.price,
    low: firstTrade.price,
    close: firstTrade.price,
    totalVolume: 0,
    delta: 0,
    bidVolume: 0,
    askVolume: 0,
    priceLevels: new Map<string, PriceLevelData>(),
    trades: [],
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
    if (bar && bar.timestamp) {
      const completedBar = finalizeBar(bar as FootprintBar); 
      if(completedBar.totalVolume > 0) { 
        const symbolBars = footprintDataStore.get(symbol) || [];
        symbolBars.push(completedBar);
        footprintDataStore.set(symbol, symbolBars.slice(-100)); 
        notifyListeners(completedBar);
      }
    }
    bar = initializeNewBar(symbol, barTimestamp, currentTrade);
    currentBarData.set(symbol, bar);
  }

  bar.trades.push(currentTrade);
  bar.high = Math.max(bar.high ?? currentTrade.price, currentTrade.price);
  bar.low = Math.min(bar.low ?? currentTrade.price, currentTrade.price);
  bar.close = currentTrade.price;
  bar.totalVolume = (bar.totalVolume ?? 0) + currentTrade.volume;

  const priceLevelStr = currentTrade.price.toFixed(2); 
  const priceLevelData = bar.priceLevels?.get(priceLevelStr) || { buyVolume: 0, sellVolume: 0 };

  if (currentTrade.side === 'buy') {
    bar.askVolume = (bar.askVolume ?? 0) + currentTrade.volume;
    priceLevelData.buyVolume += currentTrade.volume;
  } else { 
    bar.bidVolume = (bar.bidVolume ?? 0) + currentTrade.volume;
    priceLevelData.sellVolume += currentTrade.volume;
  }
  bar.priceLevels?.set(priceLevelStr, priceLevelData);
  if (bar.priceLevels) {
    // console.log(`[${new Date().toISOString()}] FootprintAggregator [${symbol}]: processTrade updated priceLevels. Size: ${bar.priceLevels.size}, Current Price Level: ${priceLevelStr}, Side: ${currentTrade.side}, Vol: ${currentTrade.volume}`);
  }
  bar.delta = (bar.askVolume ?? 0) - (bar.bidVolume ?? 0);
}

function finalizeBar(bar: FootprintBar): FootprintBar {
  if (bar.priceLevels) {
    console.log(`[${new Date().toISOString()}] FootprintAggregator [${bar.symbol}]: Finalizing bar for ${new Date(bar.timestamp).toISOString()}. priceLevels size: ${bar.priceLevels.size}. Keys: ${Array.from(bar.priceLevels.keys()).join(', ')}`);
  } else {
    console.log(`[${new Date().toISOString()}] FootprintAggregator [${bar.symbol}]: Finalizing bar for ${new Date(bar.timestamp).toISOString()}. priceLevels is undefined or null.`);
  }
  return {
    symbol: bar.symbol,
    timestamp: bar.timestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    totalVolume: bar.totalVolume,
    delta: bar.delta,
    bidVolume: bar.bidVolume,
    askVolume: bar.askVolume,
    priceLevels: bar.priceLevels || new Map(), // Ensure it's always a map, even if empty
    tradesInBar: (bar as any).trades || [], 
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
      if (message.data && message.data.s) { 
        processTrade(message.data.s, message.data);
      } else if (message.stream) { 
         const symbolFromStream = message.stream.split('@')[0].toUpperCase();
         if(message.data) {
            processTrade(symbolFromStream, message.data);
         }
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
        reconnectAttempts = 0; 
      }
    }, delay);
  } else {
    console.error(`[${new Date().toISOString()}] FootprintAggregator: Maximum reconnect attempts reached. Please check the connection or symbol list.`);
    reconnectAttempts = 0; 
  }
}

export function startFootprintStream(symbols: string[] = MONITORED_MARKET_SYMBOLS) {
  console.log(`[${new Date().toISOString()}] FootprintAggregator: startFootprintStream called with symbols: ${symbols.join(', ')}`);
  const newSymbols = symbols.filter(s => !activeSymbols.includes(s));
  const symbolsToRemove = activeSymbols.filter(s => !symbols.includes(s));

  activeSymbols = [...symbols]; 

  if (wsInstance && (newSymbols.length > 0 || symbolsToRemove.length > 0)) {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: Symbol list changed. Reconnecting WebSocket.`);
    wsInstance.close(); 
  } else if (!wsInstance && activeSymbols.length > 0) {
    connect();
  } else if (activeSymbols.length === 0 && wsInstance) {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: No active symbols. Closing WebSocket.`);
    wsInstance.close();
    wsInstance = null;
  } else {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: Stream already running or no symbols to start for: ${symbols.join(', ')}`);
  }
}

export function stopFootprintStream() {
  console.log(`[${new Date().toISOString()}] FootprintAggregator: stopFootprintStream called.`);
  if (wsInstance) {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: Closing WebSocket connection explicitly.`);
    activeSymbols = []; 
    wsInstance.close();
    wsInstance = null;
  }
  currentBarData.clear();
  reconnectAttempts = 0; 
}

export function getLatestFootprintBars(symbol: string, count: number = 1): FootprintBar[] {
  const bars = footprintDataStore.get(symbol) || [];
  return bars.slice(-count);
}

export function getCurrentAggregatingBar(symbol: string): (Partial<FootprintBar> & { trades: FootprintTrade[] }) | undefined {
    return currentBarData.get(symbol);
}

console.log(`[${new Date().toISOString()}] FootprintAggregator: Module loaded. Call startFootprintStream() to begin.`);
