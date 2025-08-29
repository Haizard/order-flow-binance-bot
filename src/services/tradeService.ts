
'use server';
/**
 * @fileOverview TradeService - Manages trade data using MongoDB, now with multi-user support and distinction for LONG/SHORT trades.
 */

import type { Trade, NewTradeInput } from '@/types/trade';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
import { MongoClient, type Db, type Collection, type WithId, type UpdateFilter, type Document } from 'mongodb';
import { placeNewOrder } from './binance';
import { getSettings } from './settingsService';

let MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_URI_FALLBACK = "mongodb+srv://haithammisape:hrz123@cluster0.quboghr.mongodb.net/binanceTrailblazerDb?retryWrites=true&w=majority&appName=Cluster0";

if (!MONGODB_URI) {
  const timestamp = new Date().toISOString();
  console.warn(`[${timestamp}] [tradeService] WARNING: MONGODB_URI environment variable was not found. Using fallback.`);
  MONGODB_URI = MONGODB_URI_FALLBACK;
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
 * Creates a new trade record after successfully placing the order on the exchange.
 * @param tradeInput - The details of the trade to create.
 * @returns The created trade object with exchange order details.
 * @throws Error if placing the order on the exchange fails or saving to DB fails.
 */
export async function createTrade(tradeInput: NewTradeInput): Promise<Trade> {
  const logTimestamp = new Date().toISOString();
  const { userId, symbol, quantity, tradeDirection } = tradeInput;

  if (!userId || userId.trim() === "") {
    console.error(`[${logTimestamp}] tradeService: Attempted to create trade without a valid userId for symbol: ${symbol}`);
    throw new Error('A valid userId is required to create a trade.');
  }

  // 1. Get user's API keys
  const userSettings = await getSettings(userId);
  if (!userSettings.binanceApiKey || !userSettings.binanceSecretKey) {
    throw new Error(`User ${userId} does not have API keys configured.`);
  }

  // 2. Place the order on the exchange
  console.log(`[${logTimestamp}] tradeService: Placing ${tradeDirection} order for ${quantity} of ${symbol} for user ${userId}`);
  const exchangeOrder = await placeNewOrder(
    userSettings.binanceApiKey,
    userSettings.binanceSecretKey,
    symbol,
    tradeDirection === 'LONG' ? 'BUY' : 'SELL',
    'MARKET',
    quantity
  );

  console.log(`[${logTimestamp}] tradeService: Exchange order placed successfully for user ${userId}. Order ID: ${exchangeOrder.orderId}`);

  // 3. Create and save the trade record in our database
  const tradesCollection = await getTradesCollection();
  
  const newTrade: Trade = {
    id: uuidv4(), 
    entryTimestamp: Date.now(),
    status: tradeDirection === 'LONG' ? 'ACTIVE_LONG_ENTRY' : 'ACTIVE_SHORT_ENTRY',
    ...tradeInput,
    exchangeOrderId: exchangeOrder.orderId,
    exchangeStatus: exchangeOrder.status,
  };

  const result = await tradesCollection.insertOne(newTrade);
  if (!result.insertedId) {
    console.error(`[${logTimestamp}] tradeService (MongoDB): CRITICAL - Placed order ${exchangeOrder.orderId} but failed to insert trade record for user ${userId}, symbol ${newTrade.symbol}`);
    throw new Error('Failed to create trade in database after placing exchange order.');
  }
  
  console.log(`[${logTimestamp}] tradeService (MongoDB): Trade record created with ID ${newTrade.id} for user ${userId}, linked to exchange order ${newTrade.exchangeOrderId}`);
  return newTrade; 
}


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

export async function updateTrade(
    userId: string, 
    tradeId: string, 
    updates: Partial<Omit<Trade, 'id' | 'userId' | 'symbol' | 'entryPrice' | 'quantity' | 'entryTimestamp' | 'baseAsset' | 'quoteAsset' | 'initialStopLossPrice' | 'tradeDirection'>>
): Promise<Trade> {
  const logTimestamp = new Date().toISOString();
  if (!userId || userId.trim() === "") {
    console.error(`[${logTimestamp}] tradeService (MongoDB): Attempted to update trade ID ${tradeId} with an invalid userId.`);
    throw new Error('A valid userId is required to update a trade.');
  }
  console.log(`[${logTimestamp}] tradeService.updateTrade (MongoDB) called for user: ${userId}, ID: ${tradeId} with updates:`, JSON.stringify(updates));
  const tradesCollection = await getTradesCollection();

  const finalUpdates: Partial<Document> = { ...updates };
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
