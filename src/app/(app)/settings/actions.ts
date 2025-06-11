
'use server';

import * as tradeService from '@/services/tradeService';

interface ClearTradesResult {
  success: boolean;
  message: string;
  error?: string;
}

export async function handleClearUserTrades(userId: string): Promise<ClearTradesResult> {
  const logTimestamp = new Date().toISOString();
  console.log(`[${logTimestamp}] Server Action: handleClearUserTrades called for userId: ${userId}`);

  if (!userId) {
    console.error(`[${logTimestamp}] Server Action: handleClearUserTrades - userId is missing.`);
    return { success: false, message: 'User ID is required.' };
  }

  // The primary safety check is within tradeService.clearUserTradesFromDb
  // This server action acts as a pass-through but can add more checks if needed.
  // For example, ensuring only an admin or the user themselves can trigger this for their ID.
  // For now, DEMO_USER_ID is the only one, so it's simpler.

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
