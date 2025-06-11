
'use server';
/**
 * @fileOverview SettingsService - Manages user-specific settings (API keys and bot strategy) using MongoDB.
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
const COLLECTION_NAME = 'userApiSettings'; // Collection now stores API keys and strategy params

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
 * Retrieves the settings (API keys and strategy) for a specific user from MongoDB.
 * If no settings are found, returns default settings populated with the userId.
 * @param userId - The ID of the user whose settings to retrieve.
 * @returns A promise that resolves to the SettingsFormValues for the user.
 */
export async function getSettings(userId: string): Promise<SettingsFormValues> {
  const logTimestamp = new Date().toISOString();
  if (!userId) {
    console.warn(`[${logTimestamp}] settingsService.getSettings (MongoDB): Called without userId. Returning default settings with a placeholder userId.`);
    // Ensure all fields from SettingsFormValues are present in the default
    const fullDefaultSettings = { ...defaultSettingsValues, userId: "UNKNOWN_USER_ID_IN_GETSETTINGS" };
    return fullDefaultSettings;
  }
  console.log(`[${logTimestamp}] settingsService.getSettings (MongoDB) called for user: ${userId}`);
  const settingsCollection = await getSettingsCollection();

  const settingsDoc = await settingsCollection.findOne({ userId: userId });

  if (settingsDoc) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...settingsWithoutMongoId } = settingsDoc as WithId<SettingsFormValues>;
    // Merge fetched settings with defaults to ensure all fields are present, especially for users with older settings objects
    const mergedSettings = { ...defaultSettingsValues, ...settingsWithoutMongoId, userId: userId };
    console.log(`[${logTimestamp}] settingsService.getSettings (MongoDB): Found existing settings for user ${userId}. API Key Present: ${!!mergedSettings.binanceApiKey}, Dip%: ${mergedSettings.dipPercentage}, Buy Amount: ${mergedSettings.buyAmountUsd}`);
    return mergedSettings;
  } else {
    console.log(`[${logTimestamp}] settingsService.getSettings (MongoDB): No settings found for user ${userId}. Returning new default settings object for this user.`);
    return { ...defaultSettingsValues, userId: userId };
  }
}

/**
 * Saves the settings (API keys and strategy) for a specific user to MongoDB.
 * @param userId - The ID of the user whose settings to save.
 * @param settings - The settings to save.
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
  
  console.log(`[${logTimestamp}] settingsService.saveSettings (MongoDB) ATTEMPTING TO SAVE for user: ${userId}. Full settings object:`, JSON.stringify(settings, (key, value) => key === 'binanceSecretKey' && value ? '[REDACTED]' : value));
  
  const settingsCollection = await getSettingsCollection();

  // Destructure all relevant fields to be saved from the input 'settings' object
  const { 
    userId: settingsUserId, // This is used for $setOnInsert
    binanceApiKey, 
    binanceSecretKey,
    dipPercentage,
    buyAmountUsd,
    trailActivationProfit,
    trailDelta
  } = settings;

  // Ensure that strategy parameters are numbers and fall back to defaults from defaultSettingsValues if undefined in input
  // This covers cases where form fields might be empty or not submitted
  const settingsDataToSet = {
    binanceApiKey: binanceApiKey || "", 
    binanceSecretKey: binanceSecretKey || "", 
    dipPercentage: typeof dipPercentage === 'number' ? dipPercentage : defaultSettingsValues.dipPercentage,
    buyAmountUsd: typeof buyAmountUsd === 'number' && buyAmountUsd > 0 ? buyAmountUsd : defaultSettingsValues.buyAmountUsd,
    trailActivationProfit: typeof trailActivationProfit === 'number' && trailActivationProfit > 0 ? trailActivationProfit : defaultSettingsValues.trailActivationProfit,
    trailDelta: typeof trailDelta === 'number' && trailDelta > 0 ? trailDelta : defaultSettingsValues.trailDelta,
  };

  const filter = { userId: userId };
  const updateOperation: UpdateFilter<SettingsFormValues> = {
    $set: settingsDataToSet, 
    $setOnInsert: { userId: settingsUserId } // Ensures userId is set on document creation
  };

  console.log(`[${logTimestamp}] settingsService.saveSettings (MongoDB) for user: ${userId}. Filter:`, JSON.stringify(filter));
  console.log(`[${logTimestamp}] settingsService.saveSettings (MongoDB) for user: ${userId}. Update Operation ($set part):`, JSON.stringify(settingsDataToSet));

  try {
    const result = await settingsCollection.updateOne(
      filter,
      updateOperation,
      { upsert: true }
    );

    console.log(`[${logTimestamp}] settingsService.saveSettings (MongoDB) for user: ${userId}. MongoDB updateOne RAW result:`, JSON.stringify(result));

    if (result.upsertedCount > 0) {
      console.log(`[${logTimestamp}] settingsService (MongoDB): Settings for user ${userId} UPSERTED successfully. Upserted ID: ${result.upsertedId}`);
    } else if (result.modifiedCount > 0) {
     console.log(`[${logTimestamp}] settingsService (MongoDB): Settings for user ${userId} MODIFIED successfully.`);
    } else if (result.matchedCount > 0 && result.modifiedCount === 0) {
      console.log(`[${logTimestamp}] settingsService (MongoDB): Settings for user ${userId} matched but NOT modified (likely same values).`);
    } else {
      console.warn(`[${logTimestamp}] settingsService (MongoDB): Settings save operation for user ${userId} resulted in no change or no match. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}, Upserted: ${result.upsertedCount > 0 ? 'Yes' : 'No'}`);
    }
  } catch (dbError) {
    console.error(`[${logTimestamp}] settingsService.saveSettings (MongoDB) for user: ${userId}. DATABASE OPERATION FAILED:`, dbError);
    throw dbError;
  }
}
