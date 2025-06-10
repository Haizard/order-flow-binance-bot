
'use server';
/**
 * @fileOverview SettingsService - Manages bot settings data using MongoDB, now user-specific.
 */

import type { SettingsFormValues } from '@/components/settings/settings-form';
import { defaultSettingsValues } from "@/config/settings-defaults"; // Import new defaults
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
const COLLECTION_NAME = 'botSettings';

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
 * Retrieves the bot settings for a specific user from MongoDB.
 * If no settings are found for the user, returns default settings populated with the userId.
 * @param userId - The ID of the user whose settings to retrieve.
 * @returns A promise that resolves to the SettingsFormValues for the user.
 */
export async function getSettings(userId: string): Promise<SettingsFormValues> { // Changed return type
  const logTimestamp = new Date().toISOString();
  if (!userId) {
    console.warn(`[${logTimestamp}] settingsService.getSettings (MongoDB): Called without userId. Returning default settings with a placeholder userId.`);
    // This case should ideally be prevented by callers providing a valid userId.
    // For robustness, return default settings with a temporary or generic userId if absolutely necessary,
    // but this indicates a potential issue in the calling code.
    return { ...defaultSettingsValues, userId: "UNKNOWN_USER_ID_IN_GETSETTINGS" };
  }
  console.log(`[${logTimestamp}] settingsService.getSettings (MongoDB) called for user: ${userId}`);
  const settingsCollection = await getSettingsCollection();

  const settingsDoc = await settingsCollection.findOne({ userId: userId });

  if (settingsDoc) {
    console.log(`[${logTimestamp}] settingsService (MongoDB): Found existing settings for user ${userId}.`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...settingsWithoutMongoId } = settingsDoc as WithId<SettingsFormValues>;
    return settingsWithoutMongoId as SettingsFormValues;
  } else {
    console.log(`[${logTimestamp}] settingsService (MongoDB): No settings found for user ${userId}. Returning new default settings object for this user.`);
    return { ...defaultSettingsValues, userId: userId };
  }
}

/**
 * Saves the bot settings for a specific user to MongoDB.
 * @param userId - The ID of the user whose settings to save.
 * @param settings - The settings to save (should include the userId).
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
  console.log(`[${logTimestamp}] settingsService.saveSettings (MongoDB) called for user: ${userId} with:`, settings);
  const settingsCollection = await getSettingsCollection();

  const { userId: settingsUserId, ...settingsDataToSet } = settings;

  const updateOperation: UpdateFilter<SettingsFormValues> = {
    $set: settingsDataToSet,
    $setOnInsert: { userId: settingsUserId }
  };

  const result = await settingsCollection.updateOne(
    { userId: userId },
    updateOperation,
    { upsert: true }
  );

  if (result.modifiedCount > 0 || result.upsertedCount > 0) {
    console.log(`[${logTimestamp}] settingsService (MongoDB): Settings for user ${userId} saved successfully. Modified: ${result.modifiedCount}, Upserted: ${result.upsertedCount}`);
  } else {
    console.warn(`[${logTimestamp}] settingsService (MongoDB): Settings save operation for user ${userId} did not modify or upsert any document. This might happen if current settings are identical to new settings.`);
  }
}
