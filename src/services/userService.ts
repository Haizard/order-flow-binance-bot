
'use server';
/**
 * @fileOverview UserService - Manages user accounts (create, find) in MongoDB.
 */

import { MongoClient, type Db, type Collection, type WithId } from 'mongodb';
import bcrypt from 'bcryptjs';
import type { User, NewUserInput } from '@/types/user';

let MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_URI_FALLBACK = "mongodb+srv://haithammisape:hrz123@cluster0.quboghr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

if (!MONGODB_URI) {
  const timestamp = new Date().toISOString();
  console.warn(`[${timestamp}] [userService] WARNING: MONGODB_URI was not found. Using fallback.`);
  MONGODB_URI = MONGODB_URI_FALLBACK;
}

const DB_NAME = process.env.MONGODB_DB_NAME || 'binanceTrailblazerDb';
const USERS_COLLECTION = 'users';

interface CustomGlobal extends NodeJS.Global {
  _mongoUserClientPromise?: Promise<MongoClient>;
}
declare const global: CustomGlobal;

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoUserClientPromise) {
    if (!MONGODB_URI) throw new Error("CRITICAL: MONGODB_URI is undefined.");
    client = new MongoClient(MONGODB_URI);
    global._mongoUserClientPromise = client.connect();
    console.log(`[${new Date().toISOString()}] [MongoDB - Users] New connection promise created (development).`);
  }
  clientPromise = global._mongoUserClientPromise;
} else {
  if (!MONGODB_URI) throw new Error("CRITICAL: MONGODB_URI is undefined.");
  client = new MongoClient(MONGODB_URI);
  clientPromise = client.connect();
  console.log(`[${new Date().toISOString()}] [MongoDB - Users] New connection promise created (production).`);
}

async function getDb(): Promise<Db> {
  const connectedClient = await clientPromise;
  return connectedClient.db(DB_NAME);
}

async function getUsersCollection(): Promise<Collection<Omit<User, 'id'>>> {
    const db = await getDb();
    return db.collection<Omit<User, 'id'>>(USERS_COLLECTION);
}

export async function createUser(userData: NewUserInput): Promise<{ success: boolean; message: string; user?: User }> {
    const usersCollection = await getUsersCollection();

    const existingUser = await usersCollection.findOne({ email: userData.email });
    if (existingUser) {
        return { success: false, message: 'A user with this email already exists.' };
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);

    try {
        const result = await usersCollection.insertOne({
            email: userData.email,
            password: hashedPassword,
        });

        const createdUser: User = {
            id: result.insertedId.toString(),
            email: userData.email,
        };

        return { success: true, message: 'User created successfully.', user: createdUser };
    } catch (error) {
        console.error(`[${new Date().toISOString()}] [userService] Error creating user:`, error);
        return { success: false, message: 'A database error occurred during user creation.' };
    }
}

export async function findUserByEmail(email: string): Promise<User & { password?: string } | null> {
    try {
        const usersCollection = await getUsersCollection();
        const userDoc = await usersCollection.findOne({ email });

        if (!userDoc) {
            return null;
        }

        const { _id, ...user } = userDoc as WithId<User & { password?: string }>;
        return { id: _id.toString(), ...user };
    } catch (error) {
        console.error(`[${new Date().toISOString()}] [userService] Database error in findUserByEmail for ${email}:`, error);
        // Do not throw the original error to the client, but return null as if user was not found.
        // This prevents leaking database implementation details.
        return null;
    }
}

export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
}
