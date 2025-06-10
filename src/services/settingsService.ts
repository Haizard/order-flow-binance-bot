
'use server';
/**
 * @fileOverview SettingsService - Manages user-specific settings (now primarily API keys) using MongoDB.
 */

import type { SettingsFormValues } from '@/components/settings/settings-form';
import { defaultSettingsValues } from "@/config/settings-defaults";
import { MongoClient, type Db, type Collection, type WithId, type UpdateFilter } from 'mongodb';

console.log(`[${new Date().toISOString()}] [settingsService] Module loading. Attempting to read MONGODB_URI from process.env...`);

let MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_URI_FALLBACK = "mongodb+srv://haithammisape:hrz123@cluster0.quboghr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

if (!MONGODB_URI) {
  const timestamp = new Date().toISOString();
  console.warn(`[${timestamp}] [settingsService] **************************************************************************************`);
  console.warn(`[${timestamp}] [settingsService] WARNING: MONGODB_URI environment variable was not found.`);
  console.warn(`[${timestamp}] [settingsService] Attempting to use a hardcoded fallback URI (THIS IS A TEMPORARY WORKAROUND): ${MONGODB_URI_FALLBACK.substring(0, MONGODB_URI_FALLBACK.indexOf('@') + 1)}...`);
  console.warn(`[${timestamp}] [settingsService] PLEASE RESOLVE YOUR .env.local CONFIGURATION OR ENVIRONMENT SETUP.`);
  console.warn(`[${timestamp}] [settingsService] **************************************************************************************`);
  MONGODB_URI = MONGODB_URI_FALLBACK;
} else {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [settingsService] MONGODB_URI successfully loaded from environment variables or using fallback.`);
}


const DB_NAME = process.env.MONGODB_DB_NAME || 'binanceTrailblazerDb';
const COLLECTION_NAME = 'userApiSettings'; 

interface CustomGlobal extends NodeJS.Global {
  _mongoSettingsClientPromise?: Promise<MongoClient>;
}
declare const global: CustomGlobal;

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoSettingsClientPromise) {
    if (!MONGODB_URI) {
        throw new Error("CRITICAL: MONGODB_URI is still undefined even after fallback. Cannot initialize MongoDB client for settings.");
    }
    client = new MongoClient(MONGODB_URI);
    global._mongoSettingsClientPromise = client.connect();
    console.log(`[${new Date().toISOString()}] [MongoDB - Settings] New connection promise created (development).`);
  }
  clientPromise = global._mongoSettingsClientPromise;
} else {
   if (!MONGODB_URI) {
        throw new Error("CRITICAL: MONGODB_URI is undefined. Cannot initialize MongoDB client for settings in production.");
    }
  client = new MongoClient(MONGODB_URI);
  clientPromise = client.connect();
  console.log(`[${new Date().toISOString()}] [MongoDB - Settings] New connection promise created (production).`);
}

async function getDb(): Promise<Db> {
  const connectedClient = await clientPromise;
  return connectedClient.db(DB_NAME);
}

async function getSettingsCollection(): Promise<Collection<SettingsFormValues>> {
  const db = await getDb();
  return db.collection<SettingsFormValues>(COLLECTION_NAME);
}

/**
 * Retrieves the API key settings for a specific user from MongoDB.
 * If no settings are found for the user, returns default settings populated with the userId.
 * @param userId - The ID of the user whose settings to retrieve.
 * @returns A promise that resolves to the SettingsFormValues (API keys) for the user.
 */
export async function getSettings(userId: string): Promise<SettingsFormValues> {
  const logTimestamp = new Date().toISOString();
  if (!userId) {
    console.warn(`[${logTimestamp}] settingsService.getSettings (MongoDB): Called without userId. Returning default settings with a placeholder userId.`);
    return { ...defaultSettingsValues, userId: "UNKNOWN_USER_ID_IN_GETSETTINGS" };
  }
  console.log(`[${logTimestamp}] settingsService.getSettings (MongoDB) called for user: ${userId}`);
  const settingsCollection = await getSettingsCollection();

  const settingsDoc = await settingsCollection.findOne({ userId: userId });

  if (settingsDoc) {
    const apiKeyPresent = !!settingsDoc.binanceApiKey && settingsDoc.binanceApiKey.length > 0;
    const secretKeyPresent = !!settingsDoc.binanceSecretKey && settingsDoc.binanceSecretKey.length > 0;
    console.log(`[${logTimestamp}] settingsService (MongoDB): Found existing API key settings for user ${userId}. API Key Present: ${apiKeyPresent}, Secret Key Present: ${secretKeyPresent}`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...settingsWithoutMongoId } = settingsDoc as WithId<SettingsFormValues>;
    return { ...defaultSettingsValues, ...settingsWithoutMongoId, userId: userId };
  } else {
    console.log(`[${logTimestamp}] settingsService (MongoDB): No API key settings found for user ${userId}. Returning new default settings object for this user.`);
    return { ...defaultSettingsValues, userId: userId };
  }
}

/**
 * Saves the API key settings for a specific user to MongoDB.
 * @param userId - The ID of the user whose settings to save.
 * @param settings - The settings (API keys and userId) to save.
 * @returns A promise that resolves when settings are saved.
 */
export async function saveSettings(userId: string, settings: SettingsFormValues): Promise<void> {
  const logTimestamp = new Date().toISOString();
   if (!userId) {
    console.error(`[${logTimestamp}] settingsService.saveSettings (MongoDB): Attempted to save settings without userId.`);
    throw new Error('userId is required to save settings.');
  }
  if (settings.userId !== userId) {
    console.error(`[${logTimestamp}] settingsService.saveSettings (MongoDB): Mismatch between parameter userId ('${userId}') and settings.userId ('${settings.userId}').`);
    throw new Error('User ID mismatch in saveSettings.');
  }
  
  const apiKeyProvided = !!settings.binanceApiKey && settings.binanceApiKey.length > 0;
  const secretKeyProvided = !!settings.binanceSecretKey && settings.binanceSecretKey.length > 0;
  console.log(`[${logTimestamp}] settingsService.saveSettings (MongoDB) called for user: ${userId}. API Key Provided: ${apiKeyProvided}, Secret Key Provided: ${secretKeyProvided}`);
  
  const settingsCollection = await getSettingsCollection();

  const { userId: settingsUserId, binanceApiKey, binanceSecretKey } = settings;
  const settingsDataToSet = {
    binanceApiKey: binanceApiKey || "", // Ensure empty string if undefined/null
    binanceSecretKey: binanceSecretKey || "", // Ensure empty string if undefined/null
  };

  const updateOperation: UpdateFilter<SettingsFormValues> = {
    $set: settingsDataToSet, 
    $setOnInsert: { userId: settingsUserId } 
  };

  const result = await settingsCollection.updateOne(
    { userId: userId },
    updateOperation,
    { upsert: true }
  );

  if (result.upsertedCount > 0) {
    console.log(`[${logTimestamp}] settingsService (MongoDB): API Key settings for user ${userId} UPSERTED successfully.`);
  } else if (result.modifiedCount > 0) {
     console.log(`[${logTimestamp}] settingsService (MongoDB): API Key settings for user ${userId} MODIFIED successfully.`);
  } else if (result.matchedCount > 0 && result.modifiedCount === 0) {
    console.log(`[${logTimestamp}] settingsService (MongoDB): API Key settings for user ${userId} matched but NOT modified (likely same values).`);
  }
   else {
    console.warn(`[${logTimestamp}] settingsService (MongoDB): API Key settings save operation for user ${userId} did not result in an obvious change. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}, Upserted: ${result.upsertedCount > 0}`);
  }
}
