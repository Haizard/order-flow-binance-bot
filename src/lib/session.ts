
import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { User } from '@/types/user';

const secretKey = process.env.SESSION_SECRET;
if (!secretKey) {
    console.warn("WARNING: SESSION_SECRET is not set. Using a default insecure key. Please set a strong secret in your .env.local file for production.");
}
const key = new TextEncoder().encode(secretKey || 'default-insecure-secret-key-for-development');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';

interface SessionPayload extends User {
    isAdmin: boolean;
}

export async function encrypt(payload: SessionPayload) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(key);
}

export async function decrypt(input: string): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(input, key, {
            algorithms: ['HS256'],
        });
        return payload as SessionPayload;
    } catch (error) {
        // This can happen if the token is expired or invalid
        console.log('Failed to verify session token:', (error as Error).message);
        return null;
    }
}

export async function createSession(user: User) {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // Expires in 24 hours
    const isAdmin = user.email === ADMIN_EMAIL;
    const sessionPayload: SessionPayload = { ...user, isAdmin };
    const session = await encrypt(sessionPayload);

    cookies().set('session', session, { expires, httpOnly: true, secure: process.env.NODE_ENV === 'production' });
}

export async function getSession(): Promise<SessionPayload | null> {
    const sessionCookie = cookies().get('session')?.value;
    if (!sessionCookie) return null;
    return await decrypt(sessionCookie);
}

export async function deleteSession() {
    cookies().delete('session');
}
