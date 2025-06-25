/**
 * @fileOverview Handles WebSocket connection to Binance for trade streams
 * and aggregates data into FootprintBar structures. Runs as a persistent service.
 */

import WebSocket from 'ws';
import type { FootprintTrade, FootprintBar, PriceLevelData, BinanceTradeData, BinanceStreamData } from '@/types/footprint';
import { MONITORED_MARKET_SYMBOLS } from '@/config/bot-strategy';
import { runBotCycle } from '@/core/bot';
import { getSettings } from '@/services/settingsService';

const BINANCE_FUTURES_WEBSOCKET_URL = 'wss://fstream.binance.com/stream';
const AGGREGATION_INTERVAL_MS = 60 * 1000; // 1 minute
const BOT_CYCLE_INTERVAL_MS = 60 * 1000; // Run bot logic every 1 minute
const DEMO_USER_ID = "admin001";

const footprintDataStore = new Map<string, FootprintBar[]>(); // Stores arrays of completed bars
const currentBarData = new Map<string, Partial<FootprintBar>>(); // Stores the currently aggregating bar

let wsInstance: WebSocket | null = null;
let activeSymbols: string[] = [];
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_BASE = 1000; // 1 second
let pingTimeout: NodeJS.Timeout | null = null;
let keepAliveIntervalId: NodeJS.Timeout | null = null;
let botIntervalId: NodeJS.Timeout | null = null;

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
        footprintDataStore.set(symbol, symbolBars.slice(-100));
        notifyListeners(completedBar, 'footprintUpdate');
      }
    }
    bar = initializeNewBar(symbol, barTimestamp);
    currentBarData.set(symbol, bar);
  }
  
  if (!bar.priceLevels) { 
    bar.priceLevels = new Map<string, PriceLevelData>();
  }
  if (!bar.tradesInBar) { 
     bar.tradesInBar = [];
  }

  if (bar.open === undefined) bar.open = currentTrade.price;
  bar.high = Math.max(bar.high ?? currentTrade.price, currentTrade.price);
  bar.low = Math.min(bar.low ?? currentTrade.price, currentTrade.price);
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

  bar.delta = (bar.askVolume ?? 0) - (bar.bidVolume ?? 0);
  currentBarData.set(symbol, bar);
  notifyListeners(bar, 'footprintUpdatePartial');
}

function finalizeBar(barToFinalize: Partial<FootprintBar>): FootprintBar {
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
      wsInstance.terminate();
    }
  }, 3 * 60 * 1000 + 5000); // 3 minutes + 5 seconds grace period
}

async function startBotCycle() {
    if (botIntervalId) return; // Already running

    console.log(`[${new Date().toISOString()}] FootprintAggregator: Starting continuous bot cycle (every ${BOT_CYCLE_INTERVAL_MS / 1000}s).`);
    
    // Initial run right away
    try {
        const settings = await getSettings(DEMO_USER_ID);
        if (settings.hasActiveSubscription) await runBotCycle(DEMO_USER_ID);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] FootprintAggregator: Error during initial bot cycle execution:`, error);
    }
    
    // Interval for subsequent runs
    botIntervalId = setInterval(async () => {
        try {
            const settings = await getSettings(DEMO_USER_ID);
            if (settings.hasActiveSubscription) await runBotCycle(DEMO_USER_ID);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] FootprintAggregator: Error during periodic bot cycle execution:`, error);
        }
    }, BOT_CYCLE_INTERVAL_MS);
}

function stopBotCycle() {
    if (botIntervalId) {
        clearInterval(botIntervalId);
        botIntervalId = null;
        console.log(`[${new Date().toISOString()}] FootprintAggregator: Stopped continuous bot cycle.`);
    }
}

function connect() {
  if (wsInstance && (wsInstance.readyState === WebSocket.OPEN || wsInstance.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const streams = activeSymbols.map(s => `${s.toLowerCase()}@trade`).join('/');
  if (!streams) {
    return;
  }
  const url = `${BINANCE_FUTURES_WEBSOCKET_URL}?streams=${streams}`;
  console.log(`[${new Date().toISOString()}] FootprintAggregator: Connecting to ${url}`);

  wsInstance = new WebSocket(url);
  heartbeat();

  wsInstance.on('open', () => {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: WebSocket connection established for symbols: ${activeSymbols.join(', ')}.`);
    reconnectAttempts = 0;
    heartbeat();

    if (keepAliveIntervalId) clearInterval(keepAliveIntervalId);
    keepAliveIntervalId = setInterval(() => {
      if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
        wsInstance.ping();
      }
    }, 3 * 60 * 1000);
  });

  wsInstance.on('message', (data: WebSocket.Data) => {
    try {
      const message: BinanceStreamData = JSON.parse(data.toString());
      if (message.stream && message.data && message.data.s) {
        const symbolFromStream = message.stream.split('@')[0].toUpperCase();
        processTrade(symbolFromStream, message.data);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] FootprintAggregator: Error processing message:`, error, data.toString());
    }
  });

  wsInstance.on('ping', () => {
    wsInstance?.pong();
  });

  wsInstance.on('pong', () => {
    heartbeat();
  });

  wsInstance.on('error', (error: Error) => {
    console.error(`[${new Date().toISOString()}] FootprintAggregator: WebSocket error:`, error.message);
  });

  wsInstance.on('close', (code: number, reason: Buffer) => {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: WebSocket connection closed. Code: ${code}, Reason: ${reason.toString()}.`);
    if (pingTimeout) clearTimeout(pingTimeout);
    if (keepAliveIntervalId) clearInterval(keepAliveIntervalId);
    wsInstance = null;
    // Don't stop bot cycle. It should persist.
    if (activeSymbols.length > 0 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        attemptReconnect();
    }
  });
}

function attemptReconnect() {
  reconnectAttempts++;
  const delay = Math.pow(2, reconnectAttempts - 1) * RECONNECT_DELAY_BASE;
  console.log(`[${new Date().toISOString()}] FootprintAggregator: Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s.`);
  setTimeout(() => {
    if (activeSymbols.length > 0) connect();
  }, delay);
}

export function startFootprintStream(symbols: string[]) {
  const newSymbols = symbols.filter(s => s.trim() !== '' && !activeSymbols.includes(s.toUpperCase()));
  const symbolsToKeep = activeSymbols.filter(s => symbols.map(sy => sy.toUpperCase()).includes(s));
  const finalSymbolList = [...new Set([...symbolsToKeep, ...newSymbols.map(s => s.toUpperCase())])];

  const oldSymbolsJSON = JSON.stringify(activeSymbols.sort());
  const newSymbolsJSON = JSON.stringify(finalSymbolList.sort());

  if (newSymbolsJSON !== oldSymbolsJSON || (!wsInstance && finalSymbolList.length > 0)) {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: Symbol list changing to [${finalSymbolList.join(',')}], restarting WebSocket.`);
    activeSymbols = finalSymbolList;

    if (wsInstance) {
      const tempWs = wsInstance;
      wsInstance = null;
      // Prevent automatic reconnection from the 'close' event handler while we are manually restarting.
      tempWs.removeAllListeners('close'); 
      tempWs.close();
      setTimeout(connect, 500); // Give it a moment to close before reconnecting.
    } else {
      connect();
    }
  }
}

export function stopFootprintStream() {
  console.log(`[${new Date().toISOString()}] FootprintAggregator: stopFootprintStream called. This will stop WebSocket data but not the bot cycle.`);
  activeSymbols = [];
  if (wsInstance) {
    const tempWsInstance = wsInstance;
    wsInstance = null;
    tempWsInstance.removeAllListeners('close');
    tempWsInstance.close();
    if (pingTimeout) clearTimeout(pingTimeout);
    if (keepAliveIntervalId) clearInterval(keepAliveIntervalId);
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

/**
 * Initializes the persistent aggregator and bot cycle.
 * This should be called once when the server starts.
 */
function initializePersistentServices() {
    console.log(`[${new Date().toISOString()}] FootprintAggregator: Initializing persistent data aggregation and bot cycle.`);
    // Start the WebSocket stream with the default symbols the bot needs.
    startFootprintStream(MONITORED_MARKET_SYMBOLS);
    // Start the bot cycle, which will now run independently of client connections.
    startBotCycle();
}

// Auto-initialize the service when this module is loaded by the server.
initializePersistentServices();
