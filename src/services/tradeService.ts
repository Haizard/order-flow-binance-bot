
'use server';
/**
 * @fileOverview TradeService - Manages trade data using MongoDB, now with multi-user support and distinction for LONG/SHORT trades.
 */

import type { Trade, NewTradeInput } from '@/types/trade';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
import { MongoClient, type Db, type Collection, type WithId, type UpdateFilter, type Document } from 'mongodb';

console.log(`[${new Date().toISOString()}] [tradeService] Module loading. Attempting to read MONGODB_URI from process.env...`);

let MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_URI_FALLBACK = "mongodb+srv://haithammisape:hrz123@cluster0.quboghr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

if (!MONGODB_URI) {
  const timestamp = new Date().toISOString();
  console.warn(`[${timestamp}] [tradeService] **************************************************************************************`);
  console.warn(`[${timestamp}] [tradeService] WARNING: MONGODB_URI environment variable was not found.`);
  console.warn(`[${timestamp}] [tradeService] Attempting to use a hardcoded fallback URI (THIS IS A TEMPORARY WORKAROUND): ${MONGODB_URI_FALLBACK.substring(0, MONGODB_URI_FALLBACK.indexOf('@') + 1)}...`);
  console.warn(`[${timestamp}] [tradeService] PLEASE RESOLVE YOUR .env.local CONFIGURATION OR ENVIRONMENT SETUP.`);
  console.warn(`[${timestamp}] [tradeService] **************************************************************************************`);
  MONGODB_URI = MONGODB_URI_FALLBACK;
} else {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [tradeService] MONGODB_URI successfully loaded from environment variables or using fallback.`);
}


const DB_NAME = process.env.MONGODB_DB_NAME || 'binanceTrailblazerDb'; 
const COLLECTION_NAME = 'trades'; 

interface CustomGlobal extends NodeJS.Global {
  _mongoClientPromise?: Promise<MongoClient>;
}
declare const global: CustomGlobal;

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    if (!MONGODB_URI) {
        throw new Error("CRITICAL: MONGODB_URI is still undefined even after fallback. Cannot initialize MongoDB client.");
    }
    client = new MongoClient(MONGODB_URI);
    global._mongoClientPromise = client.connect();
    console.log(`[${new Date().toISOString()}] [MongoDB - Trades] New connection promise created (development).`);
  }
  clientPromise = global._mongoClientPromise;
} else {
   if (!MONGODB_URI) {
        throw new Error("CRITICAL: MONGODB_URI is undefined. Cannot initialize MongoDB client in production.");
    }
  client = new MongoClient(MONGODB_URI);
  clientPromise = client.connect();
  console.log(`[${new Date().toISOString()}] [MongoDB - Trades] New connection promise created (production).`);
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
 * Creates a new trade for a specific user and saves it to MongoDB.
 * @param tradeInput - The details of the trade to create, including userId, tradeDirection, and initialStopLossPrice.
 * @returns The created trade object.
 */
export async function createTrade(tradeInput: NewTradeInput): Promise<Trade> {
  const logTimestamp = new Date().toISOString();
  if (!tradeInput.userId) {
    console.error(`[${logTimestamp}] tradeService (MongoDB): Attempted to create trade without userId for symbol: ${tradeInput.symbol}`);
    throw new Error('userId is required to create a trade.');
  }
  console.log(`[${logTimestamp}] tradeService.createTrade (MongoDB) called for user: ${tradeInput.userId}, symbol: ${tradeInput.symbol}, direction: ${tradeInput.tradeDirection}, SL: ${tradeInput.initialStopLossPrice}`);
  const tradesCollection = await getTradesCollection();
  
  const newTrade: Trade = {
    id: uuidv4(), 
    entryTimestamp: Date.now(),
    status: tradeInput.tradeDirection === 'LONG' ? 'ACTIVE_LONG_ENTRY' : 'ACTIVE_SHORT_ENTRY',
    ...tradeInput, 
  };

  const result = await tradesCollection.insertOne(newTrade);
  if (!result.insertedId) {
    console.error(`[${logTimestamp}] tradeService (MongoDB): Failed to insert trade for user ${tradeInput.userId}, symbol ${newTrade.symbol}`);
    throw new Error('Failed to create trade in database.');
  }
  
  console.log(`[${logTimestamp}] tradeService (MongoDB): Trade created with ID ${newTrade.id} for user ${tradeInput.userId}, direction ${newTrade.tradeDirection}`);
  return newTrade; 
}

/**
 * Retrieves all trades for a specific user that are currently active from MongoDB.
 * @param userId - The ID of the user whose active trades to retrieve.
 * @returns A promise that resolves to an array of active Trade objects for the user.
 */
export async function getActiveTrades(userId: string): Promise<Trade[]> {
  const logTimestamp = new Date().toISOString();
   if (!userId) {
    console.warn(`[${logTimestamp}] tradeService.getActiveTrades (MongoDB): Called without userId. Returning empty array.`);
    return [];
  }
  console.log(`[${logTimestamp}] tradeService.getActiveTrades (MongoDB) called for user: ${userId}`);
  const tradesCollection = await getTradesCollection();
  
  const activeTrades = await tradesCollection.find({
    userId: userId,
    status: { $in: ['ACTIVE_LONG_ENTRY', 'ACTIVE_TRAILING_LONG', 'ACTIVE_SHORT_ENTRY', 'ACTIVE_TRAILING_SHORT'] }
  }).toArray();

  return activeTrades.map(tradeDoc => {
    const { _id, ...tradeWithoutMongoId } = tradeDoc as WithId<Trade>;
    return tradeWithoutMongoId as Trade;
  });
}

/**
 * Retrieves all trades for a specific user that have been closed from MongoDB.
 * @param userId - The ID of the user whose closed trades to retrieve.
 * @returns A promise that resolves to an array of closed Trade objects for the user.
 */
export async function getClosedTrades(userId: string): Promise<Trade[]> {
  const logTimestamp = new Date().toISOString();
  if (!userId) {
    console.warn(`[${logTimestamp}] tradeService.getClosedTrades (MongoDB): Called without userId. Returning empty array.`);
    return [];
  }
  console.log(`[${logTimestamp}] tradeService.getClosedTrades (MongoDB) called for user: ${userId}`);
  const tradesCollection = await getTradesCollection();

  const closedTradeDocs = await tradesCollection.find({
    userId: userId,
    status: { $in: ['CLOSED_EXITED', 'CLOSED_ERROR'] }
  }).toArray();
  
  console.log(`[${logTimestamp}] tradeService.getClosedTrades (MongoDB): Found ${closedTradeDocs.length} closed trade documents for user ${userId} from DB.`);

  return closedTradeDocs.map(tradeDoc => {
    const { _id, ...tradeWithoutMongoId } = tradeDoc as WithId<Trade>;
    return tradeWithoutMongoId as Trade;
  });
}

/**
 * Updates an existing trade for a specific user in MongoDB.
 * @param userId - The ID of the user who owns the trade.
 * @param tradeId - The application-level ID (uuid) of the trade to update.
 * @param updates - An object containing the fields to update.
 * @returns The updated trade object.
 * @throws Error if the trade is not found or update fails.
 */
export async function updateTrade(
    userId: string, 
    tradeId: string, 
    updates: Partial<Omit<Trade, 'id' | 'userId' | 'symbol' | 'entryPrice' | 'quantity' | 'entryTimestamp' | 'baseAsset' | 'quoteAsset' | 'initialStopLossPrice' | 'tradeDirection'>>
): Promise<Trade> {
  const logTimestamp = new Date().toISOString();
  if (!userId) {
    console.error(`[${logTimestamp}] tradeService (MongoDB): Attempted to update trade ID ${tradeId} without userId.`);
    throw new Error('userId is required to update a trade.');
  }
  console.log(`[${logTimestamp}] tradeService.updateTrade (MongoDB) called for user: ${userId}, ID: ${tradeId} with updates:`, JSON.stringify(updates));
  const tradesCollection = await getTradesCollection();

  const finalUpdates: Partial<Document> = { ...updates }; // Use Document type for $set
  if (finalUpdates.status === 'CLOSED_EXITED' || finalUpdates.status === 'CLOSED_ERROR') {
    if (!finalUpdates.exitTimestamp) {
      finalUpdates.exitTimestamp = Date.now();
    }
  }

  const result = await tradesCollection.findOneAndUpdate(
    { id: tradeId, userId: userId }, 
    { $set: finalUpdates },
    { returnDocument: 'after' } 
  );

  if (!result) {
    console.error(`[${logTimestamp}] tradeService (MongoDB): Trade not found for user ${userId}, ID ${tradeId} or update failed.`);
    throw new Error(`Trade with ID ${tradeId} for user ${userId} not found or update failed.`);
  }
  const { _id, ...updatedTrade } = result as WithId<Trade>; 
  return updatedTrade as Trade;
}

/**
 * Retrieves a specific trade by its application-level ID for a specific user from MongoDB.
 * @param userId - The ID of the user who owns the trade.
 * @param tradeId The application-level ID (uuid) of the trade to retrieve.
 * @returns The trade object, or null if not found for that user.
 */
export async function getTradeById(userId: string, tradeId: string): Promise<Trade | null> {
  const logTimestamp = new Date().toISOString();
  if (!userId) {
    console.warn(`[${logTimestamp}] tradeService.getTradeById (MongoDB): Called without userId for trade ID ${tradeId}. Returning null.`);
    return null;
  }
  console.log(`[${logTimestamp}] tradeService.getTradeById (MongoDB) called for user: ${userId}, ID: ${tradeId}`);
  const tradesCollection = await getTradesCollection();
  
  const tradeDoc = await tradesCollection.findOne({ id: tradeId, userId: userId }); 
  if (!tradeDoc) {
    return null;
  }
  const { _id, ...tradeWithoutMongoId } = tradeDoc as WithId<Trade>; 
  return tradeWithoutMongoId as Trade;
}

/**
 * Clears all trades for a specific user from the MongoDB collection.
 * USE WITH CAUTION. This function is protected and will only run in development
 * or if process.env.ALLOW_DB_CLEAR is explicitly set to 'true'.
 * @param userId - The ID of the user whose trades to clear.
 * @throws Error if the operation is not allowed in the current environment.
 */
export async function clearUserTradesFromDb(userId: string): Promise<void> {
  const logTimestamp = new Date().toISOString();
  if (!userId) {
    console.warn(`[${logTimestamp}] tradeService.clearUserTradesFromDb (MongoDB) - Called without userId. No action taken.`);
    return;
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  const allowDbClear = process.env.ALLOW_DB_CLEAR === 'true';

  if (!isDevelopment && !allowDbClear) {
      console.warn(`[${logTimestamp}] tradeService.clearUserTradesFromDb (MongoDB) - Blocked: Not in development or ALLOW_DB_CLEAR is not 'true'.`);
      throw new Error("Clearing user trades from database is not allowed in this environment.");
  }
  
  console.warn(`[${logTimestamp}] tradeService.clearUserTradesFromDb (MongoDB) EXECUTING for user ${userId} - Environment check passed (Dev: ${isDevelopment}, AllowClear: ${allowDbClear}). CLEARING ALL TRADES FOR THIS USER FROM DATABASE: ${DB_NAME}, COLLECTION: ${COLLECTION_NAME}`);
  const tradesCollection = await getTradesCollection();
  const deleteResult = await tradesCollection.deleteMany({ userId: userId });
  console.log(`[${logTimestamp}] tradeService.clearUserTradesFromDb (MongoDB) - Successfully deleted ${deleteResult.deletedCount} trades for user ${userId}.`);
}
