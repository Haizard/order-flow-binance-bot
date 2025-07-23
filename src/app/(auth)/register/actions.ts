
'use server';

import * as z from 'zod';
import { createUser } from '@/services/userService';

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

interface ActionResult {
    success: boolean;
    message: string;
}

export async function handleRegister(values: unknown): Promise<ActionResult> {
    const validatedFields = registerSchema.safeParse(values);

    if (!validatedFields.success) {
        return { success: false, message: 'Invalid registration data.' };
    }

    const { email, password } = validatedFields.data;

    const result = await createUser({ email, password });

    return result;
}
