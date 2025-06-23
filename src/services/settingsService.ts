
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
 * Retrieves the settings (API keys and strategy) for a specific user from MongoDB.
 * If no settings are found, returns default settings populated with the userId.
 * @param userId - The ID of the user whose settings to retrieve.
 * @returns A promise that resolves to the SettingsFormValues for the user.
 */
export async function getSettings(userId: string): Promise<SettingsFormValues> {
  const logTimestamp = new Date().toISOString();
  if (!userId) {
    const fullDefaultSettings = { ...defaultSettingsValues, userId: "UNKNOWN_USER_ID_IN_GETSETTINGS" };
    return fullDefaultSettings;
  }
  const settingsCollection = await getSettingsCollection();
  const settingsDoc = await settingsCollection.findOne({ userId: userId });

  if (settingsDoc) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...settingsWithoutMongoId } = settingsDoc as WithId<SettingsFormValues>;
    const mergedSettings = { ...defaultSettingsValues, ...settingsWithoutMongoId, userId: userId };
    return mergedSettings;
  } else {
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
    throw new Error('userId is required to save settings.');
  }
  if (settings.userId !== userId) {
    throw new Error('User ID mismatch in saveSettings.');
  }
  
  const settingsCollection = await getSettingsCollection();

  // Explicitly build the object to be saved from the settings input,
  // ensuring all parameters defined in defaultSettingsValues are included.
  const settingsDataToSet = Object.keys(defaultSettingsValues).reduce((acc, key) => {
      const typedKey = key as keyof typeof defaultSettingsValues;
      const value = settings[typedKey];
      const defaultValue = defaultSettingsValues[typedKey];
      
      // Use the provided value if it's not undefined or an empty string, otherwise use the default.
      // Coerce to number if the default value is a number.
      if (typeof defaultValue === 'number') {
        (acc as any)[typedKey] = value !== undefined && value !== '' ? Number(value) : defaultValue;
      } else {
        (acc as any)[typedKey] = value ?? defaultValue;
      }
      return acc;
  }, {} as Omit<SettingsFormValues, 'userId' | 'binanceApiKey' | 'binanceSecretKey'> & { binanceApiKey?: string; binanceSecretKey?: string });
  
  // Handle API keys separately as they are optional strings and should be saved even if empty.
  settingsDataToSet.binanceApiKey = settings.binanceApiKey || "";
  settingsDataToSet.binanceSecretKey = settings.binanceSecretKey || "";


  const filter = { userId: userId };
  const updateOperation: UpdateFilter<SettingsFormValues> = {
    $set: settingsDataToSet, 
    $setOnInsert: { userId: settings.userId } // Ensures userId is set on document creation
  };

  try {
    await settingsCollection.updateOne(
      filter,
      updateOperation,
      { upsert: true }
    );
  } catch (dbError) {
    console.error(`[${logTimestamp}] settingsService.saveSettings (MongoDB) for user: ${userId}. DATABASE OPERATION FAILED:`, dbError);
    throw dbError;
  }
}
