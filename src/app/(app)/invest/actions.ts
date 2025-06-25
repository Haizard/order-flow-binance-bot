
'use server';

import { revalidatePath } from 'next/cache';
import { createInvestment } from '@/services/projectService';

interface InvestResult {
    success: boolean;
    message: string;
}

export async function handleInvest(projectId: string, userId: string): Promise<InvestResult> {
    const result = await createInvestment(projectId, userId);
    
    if (result.success) {
        // Revalidate the invest page to update the progress bar immediately for all users.
        revalidatePath('/invest');
    }

    return result;
}
