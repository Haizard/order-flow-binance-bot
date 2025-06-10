
'use server';
/**
 * @fileOverview TradeService - Manages trade data.
 * 
 * IMPORTANT: This service currently uses an IN-MEMORY ARRAY to simulate database operations.
 * For a production application, you MUST replace this in-memory storage with
 * a persistent database solution (e.g., Firebase Firestore, PostgreSQL, MongoDB, etc.).
 * The functions are designed to be easily adaptable to such a backend.
 * 
 * Each function that interacts with `inMemoryTrades` should be rewritten
 * to perform equivalent operations on your chosen database.
 */

import type { Trade, NewTradeInput, SellTradeInput } from '@/types/trade';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

// --- IN-MEMORY DATABASE SIMULATION ---
// !!! REPLACE THIS WITH ACTUAL DATABASE INTERACTIONS !!!
let inMemoryTrades: Trade[] = [];
// !!! END OF IN-MEMORY DATABASE SIMULATION !!!


/**
 * Creates a new trade and "saves" it.
 * @param tradeInput - The details of the trade to create.
 * @returns The created trade object with an ID and timestamp.
 */
export async function createTrade(tradeInput: NewTradeInput): Promise<Trade> {
  console.log(`[${new Date().toISOString()}] tradeService.createTrade called for symbol: ${tradeInput.symbol}`);
  const newTrade: Trade = {
    ...tradeInput,
    id: uuidv4(),
    buyTimestamp: Date.now(),
    status: 'ACTIVE_BOUGHT',
  };

  // !!! DATABASE SIMULATION: Add to in-memory array !!!
  inMemoryTrades.push(newTrade);
  console.log(`[${new Date().toISOString()}] tradeService: Trade created and added to in-memory store:`, newTrade.id);
  // !!! Replace above with: await db.collection('trades').add(newTrade); or similar !!!
  
  return newTrade;
}

/**
 * Retrieves all trades that are currently active (not closed).
 * @returns A promise that resolves to an array of active Trade objects.
 */
export async function getActiveTrades(): Promise<Trade[]> {
  console.log(`[${new Date().toISOString()}] tradeService.getActiveTrades called`);
  // !!! DATABASE SIMULATION: Filter from in-memory array !!!
  const active = inMemoryTrades.filter(trade => trade.status === 'ACTIVE_BOUGHT' || trade.status === 'ACTIVE_TRAILING');
  // !!! Replace with: await db.collection('trades').where('status', 'in', ['ACTIVE_BOUGHT', 'ACTIVE_TRAILING']).get(); or similar !!!
  return active;
}

/**
 * Retrieves all trades that have been closed.
 * @returns A promise that resolves to an array of closed Trade objects.
 */
export async function getClosedTrades(): Promise<Trade[]> {
  console.log(`[${new Date().toISOString()}] tradeService.getClosedTrades called`);
  // !!! DATABASE SIMULATION: Filter from in-memory array !!!
  const closed = inMemoryTrades.filter(trade => trade.status === 'CLOSED_SOLD' || trade.status === 'CLOSED_ERROR');
  // !!! Replace with: await db.collection('trades').where('status', 'in', ['CLOSED_SOLD', 'CLOSED_ERROR']).get(); or similar !!!
  return closed;
}

/**
 * Updates an existing trade, typically its status or selling details.
 * @param tradeId - The ID of the trade to update.
 * @param updates - An object containing the fields to update.
 * @returns The updated trade object.
 * @throws Error if the trade is not found.
 */
export async function updateTrade(tradeId: string, updates: Partial<Omit<Trade, 'id' | 'symbol' | 'buyPrice' | 'quantity' | 'buyTimestamp' | 'baseAsset' | 'quoteAsset'>>): Promise<Trade> {
  console.log(`[${new Date().toISOString()}] tradeService.updateTrade called for ID: ${tradeId} with updates:`, updates);
  // !!! DATABASE SIMULATION: Find and update in-memory array !!!
  const tradeIndex = inMemoryTrades.findIndex(t => t.id === tradeId);
  if (tradeIndex === -1) {
    console.error(`[${new Date().toISOString()}] tradeService: Trade not found for update: ${tradeId}`);
    throw new Error(`Trade with ID ${tradeId} not found.`);
  }
  
  inMemoryTrades[tradeIndex] = { ...inMemoryTrades[tradeIndex], ...updates };
  if (updates.status === 'CLOSED_SOLD' || updates.status === 'CLOSED_ERROR') {
    if (!inMemoryTrades[tradeIndex].sellTimestamp) {
      inMemoryTrades[tradeIndex].sellTimestamp = Date.now();
    }
  }
  console.log(`[${new Date().toISOString()}] tradeService: Trade updated in-memory:`, inMemoryTrades[tradeIndex].id);
  // !!! Replace with: await db.collection('trades').doc(tradeId).update(updates); or similar !!!
  
  return inMemoryTrades[tradeIndex];
}

/**
 * Retrieves a specific trade by its ID.
 * @param tradeId The ID of the trade to retrieve.
 * @returns The trade object, or null if not found.
 */
export async function getTradeById(tradeId: string): Promise<Trade | null> {
  console.log(`[${new Date().toISOString()}] tradeService.getTradeById called for ID: ${tradeId}`);
  // !!! DATABASE SIMULATION: Find in in-memory array !!!
  const trade = inMemoryTrades.find(t => t.id === tradeId);
  // !!! Replace with: const doc = await db.collection('trades').doc(tradeId).get(); if (!doc.exists) return null; return doc.data(); !!!
  return trade || null;
}

/**
 * Clears all trades from the in-memory store. 
 * Useful for testing or resetting state in development.
 * THIS FUNCTION WOULD LIKELY NOT EXIST OR BE SECURED IN A PRODUCTION DATABASE SCENARIO.
 */
export async function clearAllInMemoryTrades(): Promise<void> {
  console.warn(`[${new Date().toISOString()}] tradeService.clearAllInMemoryTrades called - CLEARED ALL IN-MEMORY TRADES.`);
  inMemoryTrades = [];
}

// Example usage (not for production, for testing/illustration):
// (async () => {
//   if (process.env.NODE_ENV === 'development') {
//     await clearAllInMemoryTrades(); // Clear on server start in dev for fresh state
//     const sampleTrade = await createTrade({ symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', buyPrice: 60000, quantity: 0.01 });
//     await updateTrade(sampleTrade.id, { status: 'ACTIVE_TRAILING', trailingHighPrice: 61000 });
//     const active = await getActiveTrades();
//     // console.log('Sample active trades:', active);
//   }
// })();
