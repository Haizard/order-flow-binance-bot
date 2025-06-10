
'use server';
/**
 * @fileOverview TradeService - Manages trade data using MongoDB.
 */

import type { Trade, NewTradeInput } from '@/types/trade';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
import { MongoClient, type Db, type Collection, type WithId } from 'mongodb';

console.log(`[${new Date().toISOString()}] [tradeService] Module loading. Attempting to read MONGODB_URI from process.env...`);

let MONGODB_URI = process.env.MONGODB_URI;
// THIS IS A TEMPORARY FALLBACK FOR DEVELOPMENT ONLY.
// DO NOT USE IN PRODUCTION. CONFIGURE .env.local PROPERLY.
const MONGODB_URI_FALLBACK = "mongodb+srv://haithammisape:hrz123@cluster0.quboghr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

if (!MONGODB_URI) {
  const timestamp = new Date().toISOString();
  console.warn(`[${timestamp}] [tradeService] **************************************************************************************`);
  console.warn(`[${timestamp}] [tradeService] WARNING: MONGODB_URI environment variable was not found.`);
  console.warn(`[${timestamp}] [tradeService] Attempting to use a hardcoded fallback URI. `);
  console.warn(`[${timestamp}] [tradeService] THIS IS A TEMPORARY MEASURE FOR DEVELOPMENT AND IS NOT SAFE FOR PRODUCTION.`);
  console.warn(`[${timestamp}] [tradeService] PLEASE ENSURE YOUR .env.local FILE IS CORRECTLY CONFIGURED AND YOUR SERVER RESTARTED.`);
  console.warn(`[${timestamp}] [tradeService] Using hardcoded URI (credentials hidden in this log for safety): ${MONGODB_URI_FALLBACK.substring(0, MONGODB_URI_FALLBACK.indexOf('@') + 1)}...`);
  console.warn(`[${timestamp}] [tradeService] **************************************************************************************`);
  MONGODB_URI = MONGODB_URI_FALLBACK;
} else {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [tradeService] MONGODB_URI successfully loaded from environment variables.`);
}

const DB_NAME = process.env.MONGODB_DB_NAME || 'binanceTrailblazerDb'; // Updated default database name

// Cached connection promise
// For Next.js, it's recommended to cache the client and the connection promise,
// especially in development due to HMR (Hot Module Replacement).
// https://www.mongodb.com/docs/drivers/node/current/fundamentals/connection/connect/#how-to-implement-a-connection-handler-in-next-js

// Extend the NodeJS.Global interface to include _mongoClientPromise
interface CustomGlobal extends NodeJS.Global {
  _mongoClientPromise?: Promise<MongoClient>;
}

// Use the extended CustomGlobal type
declare const global: CustomGlobal;


let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    if (!MONGODB_URI) { // Final check before creating client
        throw new Error("CRITICAL: MONGODB_URI is still undefined even after fallback. Cannot initialize MongoDB client.");
    }
    client = new MongoClient(MONGODB_URI);
    global._mongoClientPromise = client.connect();
    console.log(`[${new Date().toISOString()}] [MongoDB] New connection promise created (development).`);
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
   if (!MONGODB_URI) { // Final check before creating client
        throw new Error("CRITICAL: MONGODB_URI is undefined. Cannot initialize MongoDB client in production.");
    }
  client = new MongoClient(MONGODB_URI);
  clientPromise = client.connect();
  console.log(`[${new Date().toISOString()}] [MongoDB] New connection promise created (production).`);
}

async function getDb(): Promise<Db> {
  const connectedClient = await clientPromise;
  return connectedClient.db(DB_NAME);
}

const COLLECTION_NAME = 'trades'; // Define collection name

async function getTradesCollection(): Promise<Collection<Trade>> {
  const db = await getDb();
  return db.collection<Trade>(COLLECTION_NAME);
}

/**
 * Creates a new trade and saves it to MongoDB.
 * @param tradeInput - The details of the trade to create.
 * @returns The created trade object.
 */
export async function createTrade(tradeInput: NewTradeInput): Promise<Trade> {
  const logTimestamp = new Date().toISOString();
  console.log(`[${logTimestamp}] tradeService.createTrade (MongoDB) called for symbol: ${tradeInput.symbol}`);
  const tradesCollection = await getTradesCollection();
  
  const newTrade: Trade = {
    ...tradeInput,
    id: uuidv4(), 
    buyTimestamp: Date.now(),
    status: 'ACTIVE_BOUGHT',
  };

  const result = await tradesCollection.insertOne(newTrade);
  if (!result.insertedId) {
    console.error(`[${logTimestamp}] tradeService (MongoDB): Failed to insert trade for symbol ${newTrade.symbol}`);
    throw new Error('Failed to create trade in database.');
  }
  
  console.log(`[${logTimestamp}] tradeService (MongoDB): Trade created with ID ${newTrade.id} and MongoDB _id ${result.insertedId}`);
  return newTrade; 
}

/**
 * Retrieves all trades that are currently active (not closed) from MongoDB.
 * @returns A promise that resolves to an array of active Trade objects.
 */
export async function getActiveTrades(): Promise<Trade[]> {
  const logTimestamp = new Date().toISOString();
  console.log(`[${logTimestamp}] tradeService.getActiveTrades (MongoDB) called`);
  const tradesCollection = await getTradesCollection();
  
  const activeTrades = await tradesCollection.find({
    status: { $in: ['ACTIVE_BOUGHT', 'ACTIVE_TRAILING'] }
  }).toArray();

  return activeTrades.map(tradeDoc => {
    const { _id, ...tradeWithoutMongoId } = tradeDoc as WithId<Trade>;
    return tradeWithoutMongoId as Trade;
  });
}

/**
 * Retrieves all trades that have been closed from MongoDB.
 * @returns A promise that resolves to an array of closed Trade objects.
 */
export async function getClosedTrades(): Promise<Trade[]> {
  const logTimestamp = new Date().toISOString();
  console.log(`[${logTimestamp}] tradeService.getClosedTrades (MongoDB) called`);
  const tradesCollection = await getTradesCollection();

  const closedTrades = await tradesCollection.find({
    status: { $in: ['CLOSED_SOLD', 'CLOSED_ERROR'] }
  }).toArray();
  
  return closedTrades.map(tradeDoc => {
    const { _id, ...tradeWithoutMongoId } = tradeDoc as WithId<Trade>;
    return tradeWithoutMongoId as Trade;
  });
}

/**
 * Updates an existing trade in MongoDB.
 * @param tradeId - The application-level ID (uuid) of the trade to update.
 * @param updates - An object containing the fields to update.
 * @returns The updated trade object.
 * @throws Error if the trade is not found or update fails.
 */
export async function updateTrade(tradeId: string, updates: Partial<Omit<Trade, 'id' | 'symbol' | 'buyPrice' | 'quantity' | 'buyTimestamp' | 'baseAsset' | 'quoteAsset'>>): Promise<Trade> {
  const logTimestamp = new Date().toISOString();
  console.log(`[${logTimestamp}] tradeService.updateTrade (MongoDB) called for ID: ${tradeId} with updates:`, JSON.stringify(updates));
  const tradesCollection = await getTradesCollection();

  const finalUpdates = { ...updates };
  if (finalUpdates.status === 'CLOSED_SOLD' || finalUpdates.status === 'CLOSED_ERROR') {
    if (!finalUpdates.sellTimestamp) {
      finalUpdates.sellTimestamp = Date.now();
    }
  }

  const result = await tradesCollection.findOneAndUpdate(
    { id: tradeId }, 
    { $set: finalUpdates },
    { returnDocument: 'after' } 
  );

  if (!result) {
    console.error(`[${logTimestamp}] tradeService (MongoDB): Trade not found for update or update failed: ${tradeId}`);
    throw new Error(`Trade with ID ${tradeId} not found or update failed.`);
  }
  const { _id, ...updatedTrade } = result as WithId<Trade>; 
  return updatedTrade as Trade;
}

/**
 * Retrieves a specific trade by its application-level ID from MongoDB.
 * @param tradeId The application-level ID (uuid) of the trade to retrieve.
 * @returns The trade object, or null if not found.
 */
export async function getTradeById(tradeId: string): Promise<Trade | null> {
  const logTimestamp = new Date().toISOString();
  console.log(`[${logTimestamp}] tradeService.getTradeById (MongoDB) called for ID: ${tradeId}`);
  const tradesCollection = await getTradesCollection();
  
  const tradeDoc = await tradesCollection.findOne({ id: tradeId }); 
  if (!tradeDoc) {
    return null;
  }
  const { _id, ...tradeWithoutMongoId } = tradeDoc as WithId<Trade>; 
  return tradeWithoutMongoId as Trade;
}

/**
 * Clears all trades from the MongoDB collection.
 * THIS FUNCTION SHOULD BE USED WITH EXTREME CAUTION, ESPECIALLY IN PRODUCTION.
 * It's primarily for testing or resetting state in development.
 */
export async function clearAllTradesFromDb(): Promise<void> {
  const logTimestamp = new Date().toISOString();
  if (process.env.NODE_ENV !== 'development' && process.env.ALLOW_DB_CLEAR !== 'true') {
      console.warn(`[${logTimestamp}] tradeService.clearAllTradesFromDb (MongoDB) - Blocked: Not in development or ALLOW_DB_CLEAR not true.`);
      throw new Error("Clearing database is not allowed in this environment.");
  }
  console.warn(`[${logTimestamp}] tradeService.clearAllTradesFromDb (MongoDB) called - CLEARING ALL TRADES FROM DATABASE: ${DB_NAME}, COLLECTION: ${COLLECTION_NAME}`);
  const tradesCollection = await getTradesCollection();
  await tradesCollection.deleteMany({});
}
