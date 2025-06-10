// --- GLOBAL BOT STRATEGY PARAMETERS ---
// These would ideally be managed by an admin or through environment variables in a production system.

/** Bot considers buying if 24hr change is less than or equal to this percentage (e.g., -5 for -5%). */
export const GLOBAL_DIP_PERCENTAGE = -5;

/** Each trade will be for this amount in USD. */
export const GLOBAL_BUY_AMOUNT_USD = 50;

/** Activate trailing stop when profit reaches this percentage (e.g., 2.5 for 2.5%). */
export const GLOBAL_TRAIL_ACTIVATION_PROFIT = 2.5;

/** Trailing stop loss distance from the high price, as a percentage (e.g., 0.8 for 0.8%). */
export const GLOBAL_TRAIL_DELTA = 0.8;

/**
 * Object exporting all global bot settings for easy import.
 */
export const BOT_GLOBAL_SETTINGS = {
    GLOBAL_DIP_PERCENTAGE,
    GLOBAL_BUY_AMOUNT_USD,
    GLOBAL_TRAIL_ACTIVATION_PROFIT,
    GLOBAL_TRAIL_DELTA,
};
