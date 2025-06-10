
'use server';
/**
 * @fileOverview TradeService - Manages trade data using MongoDB.
 */

import type { Trade, NewTradeInput } from '@/types/trade';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
import { MongoClient, type Db, type Collection, type WithId } from 'mongodb';

console.log(`[${new Date().toISOString()}] [tradeService] Module loading. Attempting to read MONGODB_URI from process.env...`);

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'binanceTrailblazerDb'; // Updated default database name

// Enhanced check with logging
if (!MONGODB_URI) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [tradeService] MONGODB_URI is NOT DEFINED or EMPTY.`);
  console.error(`[${timestamp}] [tradeService] Value read from process.env.MONGODB_URI: "${MONGODB_URI}"`);
  console.error(`[${timestamp}] [tradeService] PLEASE CHECK THE FOLLOWING:`);
  console.error(`[${timestamp}] [tradeService] 1. Ensure a file named '.env.local' exists in the ROOT of your project (same level as package.json).`);
  console.error(`[${timestamp}] [tradeService] 2. Ensure '.env.local' contains a line like: MONGODB_URI=your_actual_mongodb_connection_string_here`);
  console.error(`[${timestamp}] [tradeService] 3. Ensure you have RESTARTED your Next.js development server (e.g., 'npm run dev') after creating or modifying '.env.local'.`);
  console.error(`[${timestamp}] [tradeService] Listing all available environment variables for diagnostics:`);
  console.error(JSON.stringify(process.env, null, 2));
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
} else {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [tradeService] MONGODB_URI successfully loaded.`);
}


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
    client = new MongoClient(MONGODB_URI);
    global._mongoClientPromise = client.connect();
    console.log(`[${new Date().toISOString()}] [MongoDB] New connection promise created (development).`);
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(MONGODB_URI);
  clientPromise = client.connect();
  console.log(`[${new Date().toISOString()}] [MongoDB] New connection promise created (production).`);
}

async function getDb(): Promise<Db> {
  const connectedClient = await clientPromise;
  return connectedClient.db(DB_NAME);
}

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
  // Convert the MongoDB document to a plain Trade object before returning
  // This involves handling the _id field if you don't want it in your Trade type.
  // However, our current Trade type doesn't include _id, and we map it out in retrieval functions.
  // For create, newTrade already matches the Trade type.
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

  // Map MongoDB documents to Trade objects, excluding the _id field
  return activeTrades.map(tradeDoc => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  
  // Map MongoDB documents to Trade objects, excluding the _id field
  return closedTrades.map(tradeDoc => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    { id: tradeId }, // Filter by our application-specific 'id'
    { $set: finalUpdates },
    { returnDocument: 'after' } // Ensures the updated document is returned
  );

  if (!result) {
    console.error(`[${logTimestamp}] tradeService (MongoDB): Trade not found for update or update failed: ${tradeId}`);
    throw new Error(`Trade with ID ${tradeId} not found or update failed.`);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...updatedTrade } = result as WithId<Trade>; // Cast and exclude _id
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
  
  const tradeDoc = await tradesCollection.findOne({ id: tradeId }); // Filter by our application-specific 'id'
  if (!tradeDoc) {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...tradeWithoutMongoId } = tradeDoc as WithId<Trade>; // Cast and exclude _id
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
