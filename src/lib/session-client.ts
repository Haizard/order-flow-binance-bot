
'use client';
// This is a placeholder/helper for client components that need session info.
// In a full implementation, this might be replaced by a proper AuthContext.
// It's not ideal because it can't read httpOnly cookies directly.
// We are using it as a temporary bridge.

import type { User } from '@/types/user';

// This is a mock implementation for the client-side.
// The actual session is httpOnly and cannot be read by client-side JS.
// A proper solution involves an AuthContext populated by a server component
// or an API route that exposes necessary, non-sensitive user info.
export async function getSession(): Promise<(User & {isAdmin: boolean}) | null> {
    try {
        const res = await fetch('/api/auth/session');
        if (!res.ok) {
            return null;
        }
        const session = await res.json();
        return session.user;
    } catch (e) {
        return null;
    }
}
