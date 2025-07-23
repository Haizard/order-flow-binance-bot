
'use server';

import * as z from 'zod';
import { findUserByEmail, verifyPassword } from '@/services/userService';
import { createSession } from '@/lib/session';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface ActionResult {
    success: boolean;
    message: string;
}

export async function handleLogin(values: unknown): Promise<ActionResult> {
    const validatedFields = loginSchema.safeParse(values);

    if (!validatedFields.success) {
        return { success: false, message: 'Invalid login data.' };
    }

    const { email, password } = validatedFields.data;

    const user = await findUserByEmail(email);

    if (!user || !user.password) {
        return { success: false, message: 'Invalid email or password.' };
    }

    const passwordsMatch = await verifyPassword(password, user.password);

    if (!passwordsMatch) {
        return { success: false, message: 'Invalid email or password.' };
    }

    // Passwords match, create session
    await createSession({ id: user.id, email: user.email });

    return { success: true, message: 'Login successful.' };
}
