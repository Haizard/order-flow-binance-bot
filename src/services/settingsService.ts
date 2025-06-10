
'use server';
/**
 * @fileOverview SettingsService - Manages bot settings data using MongoDB.
 */

import type { SettingsFormValues } from '@/components/settings/settings-form';
import { defaultValues as defaultSettings } from '@/components/settings/settings-form';
import { MongoClient, type Db, type Collection, type WithId } from 'mongodb';

// MongoDB connection setup (copied from tradeService.ts for consistency)
// Ensure MONGODB_URI and MONGODB_DB_NAME are set in your .env.local
console.log(`[${new Date().toISOString()}] [settingsService] Module loading. Attempting to read MONGODB_URI from process.env...`);

let MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_URI_FALLBACK = "mongodb+srv://haithammisape:hrz123@cluster0.quboghr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"; // Temporary fallback

if (!MONGODB_URI) {
  const timestamp = new Date().toISOString();
  console.warn(`[${timestamp}] [settingsService] **************************************************************************************`);
  console.warn(`[${timestamp}] [settingsService] WARNING: MONGODB_URI environment variable was not found.`);
  console.warn(`[${timestamp}] [settingsService] Attempting to use a hardcoded fallback URI. THIS IS A TEMPORARY MEASURE FOR DEVELOPMENT.`);
  console.warn(`[${timestamp}] [settingsService] PLEASE ENSURE YOUR .env.local FILE IS CORRECTLY CONFIGURED AND YOUR SERVER RESTARTED.`);
  console.warn(`[${timestamp}] [settingsService] Using hardcoded URI.`);
  console.warn(`[${timestamp}] [settingsService] **************************************************************************************`);
  MONGODB_URI = MONGODB_URI_FALLBACK;
} else {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [settingsService] MONGODB_URI successfully loaded from environment variables or using fallback.`);
}


const DB_NAME = process.env.MONGODB_DB_NAME || 'binanceTrailblazerDb';
const COLLECTION_NAME = 'botSettings';
const SETTINGS_DOCUMENT_ID = 'current_bot_settings'; // Fixed ID for the single settings document

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
 * Retrieves the current bot settings from MongoDB.
 * If no settings are found, returns default settings.
 * @returns A promise that resolves to the SettingsFormValues.
 */
export async function getSettings(): Promise<SettingsFormValues> {
  const logTimestamp = new Date().toISOString();
  console.log(`[${logTimestamp}] settingsService.getSettings (MongoDB) called`);
  const settingsCollection = await getSettingsCollection();
  
  const settingsDoc = await settingsCollection.findOne({ id: SETTINGS_DOCUMENT_ID });

  if (settingsDoc) {
    console.log(`[${logTimestamp}] settingsService (MongoDB): Found existing settings.`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...settingsWithoutMongoId } = settingsDoc as WithId<SettingsFormValues & { id: string }>;
    return settingsWithoutMongoId as SettingsFormValues;
  } else {
    console.log(`[${logTimestamp}] settingsService (MongoDB): No settings found, returning default settings.`);
    // Ensure defaultValues (which is an export from settings-form) has all required fields.
    // We also add our fixed 'id' field to the default settings before returning,
    // though it won't be saved until saveSettings is called.
    return { ...defaultSettings } as SettingsFormValues;
  }
}

/**
 * Saves the bot settings to MongoDB.
 * Uses updateOne with upsert to create or replace the single settings document.
 * @param settings - The settings to save.
 * @returns A promise that resolves when settings are saved.
 */
export async function saveSettings(settings: SettingsFormValues): Promise<void> {
  const logTimestamp = new Date().toISOString();
  console.log(`[${logTimestamp}] settingsService.saveSettings (MongoDB) called with:`, settings);
  const settingsCollection = await getSettingsCollection();

  const settingsToSave = { ...settings, id: SETTINGS_DOCUMENT_ID };

  const result = await settingsCollection.updateOne(
    { id: SETTINGS_DOCUMENT_ID }, // Filter by our fixed ID
    { $set: settingsToSave }, // Set the new settings values
    { upsert: true } // Create the document if it doesn't exist
  );

  if (result.modifiedCount > 0 || result.upsertedCount > 0) {
    console.log(`[${logTimestamp}] settingsService (MongoDB): Settings saved successfully. Modified: ${result.modifiedCount}, Upserted: ${result.upsertedCount}`);
  } else {
    console.warn(`[${logTimestamp}] settingsService (MongoDB): Settings save operation did not modify or upsert any document. This might happen if current settings are identical to new settings.`);
  }
}
