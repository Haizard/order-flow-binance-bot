
'use server';

import * as tradeService from '@/services/tradeService';
import { getSession } from '@/lib/session';

interface ClearTradesResult {
  success: boolean;
  message: string;
  error?: string;
}

export async function handleClearUserTrades(): Promise<ClearTradesResult> {
  const session = await getSession();
  if (!session) {
      return { success: false, message: 'Authentication required.' };
  }
  const userId = session.id;
  const logTimestamp = new Date().toISOString();
  console.log(`[${logTimestamp}] Server Action: handleClearUserTrades called for userId: ${userId}`);

  // The primary safety check is within tradeService.clearUserTradesFromDb
  try {
    await tradeService.clearUserTradesFromDb(userId);
    console.log(`[${logTimestamp}] Server Action: handleClearUserTrades - Successfully cleared trades for userId: ${userId}`);
    return { success: true, message: 'All trade data for the user has been cleared.' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    console.error(`[${logTimestamp}] Server Action: handleClearUserTrades - Error clearing trades for userId: ${userId}:`, errorMessage);
    return { success: false, message: 'Failed to clear trade data.', error: errorMessage };
  }
}
