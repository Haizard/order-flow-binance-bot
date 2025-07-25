
'use server';

import { revalidatePath } from 'next/cache';
import { createInvestment } from '@/services/projectService';
import { getSession } from '@/lib/session';

interface InvestResult {
    success: boolean;
    message: string;
}

export async function handleInvest(projectId: string): Promise<InvestResult> {
    const session = await getSession();
    if (!session) {
        return { success: false, message: 'You must be logged in to invest.' };
    }

    const result = await createInvestment(projectId, session.id, session.email);
    
    if (result.success) {
        // Revalidate the invest page to update the progress bar immediately for all users.
        revalidatePath('/invest');
    }

    return result;
}
