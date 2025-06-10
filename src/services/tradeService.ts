
'use server';
/**
 * @fileOverview TradeService - Manages trade data using MongoDB.
 */

import type { Trade, NewTradeInput } from '@/types/trade';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
import { MongoClient, type Db, type Collection, type WithId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'tradingBotDb'; // You can set a default or use an env var
const COLLECTION_NAME = 'trades';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

// Cached connection promise
let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

async function getDb(): Promise<Db> {
  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    // @ts-ignore
    if (!global._mongoClientPromise) {
      client = new MongoClient(MONGODB_URI!);
      // @ts-ignore
      global._mongoClientPromise = client.connect();
    }
    // @ts-ignore
    clientPromise = global._mongoClientPromise;
  } else {
    // In production mode, it's best to not use a global variable.
    if (!clientPromise) {
      client = new MongoClient(MONGODB_URI!);
      clientPromise = client.connect();
    }
  }
  const connectedClient = await clientPromise;
  return connectedClient.db(DB_NAME);
}

async function getTradesCollection(): Promise<Collection<Trade>> {
  const db = await getDb();
  return db.collection<Trade>(COLLECTION_NAME);
}

// Helper to convert MongoDB's _id to id if needed, and vice-versa,
// though we are storing our string 'id' directly.
// MongoDB documents will have an _id field automatically.
// Our Trade type has an 'id' field (string uuid). We store this directly.
// When fetching, we might want to map _id to id if we were using _id as the primary identifier.
// For now, we'll rely on querying by our custom 'id' field.

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
    id: uuidv4(), // Our application-level unique ID
    buyTimestamp: Date.now(),
    status: 'ACTIVE_BOUGHT',
  };

  const result = await tradesCollection.insertOne(newTrade);
  if (!result.insertedId) {
    console.error(`[${logTimestamp}] tradeService (MongoDB): Failed to insert trade for symbol ${newTrade.symbol}`);
    throw new Error('Failed to create trade in database.');
  }
  
  console.log(`[${logTimestamp}] tradeService (MongoDB): Trade created with ID ${newTrade.id} and MongoDB _id ${result.insertedId}`);
  return newTrade; // Return the object with our application 'id'
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

  // MongoDB returns documents with _id. Our Trade type expects 'id'.
  // Since we store 'id' directly, we don't need a transformation here if we are careful
  // to use 'id' in our application logic and the Trade type definition reflects that.
  // The documents fetched will contain the 'id' field we inserted.
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
  console.log(`[${logTimestamp}] tradeService.updateTrade (MongoDB) called for ID: ${tradeId} with updates:`, updates);
  const tradesCollection = await getTradesCollection();

  const finalUpdates = { ...updates };
  if (finalUpdates.status === 'CLOSED_SOLD' || finalUpdates.status === 'CLOSED_ERROR') {
    if (!finalUpdates.sellTimestamp) {
      finalUpdates.sellTimestamp = Date.now();
    }
  }

  const result = await tradesCollection.findOneAndUpdate(
    { id: tradeId }, // Query by our application 'id'
    { $set: finalUpdates },
    { returnDocument: 'after' } // Return the updated document
  );

  if (!result) {
    console.error(`[${logTimestamp}] tradeService (MongoDB): Trade not found for update or update failed: ${tradeId}`);
    throw new Error(`Trade with ID ${tradeId} not found or update failed.`);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  
  const tradeDoc = await tradesCollection.findOne({ id: tradeId }); // Query by our application 'id'
  if (!tradeDoc) {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
