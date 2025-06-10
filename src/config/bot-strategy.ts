
// --- GLOBAL BOT STRATEGY PARAMETERS ---
// These are centrally managed for the entire bot's operation.

/** Bot considers buying if 24hr change is less than or equal to this percentage (e.g., -5 for -5%). */
export const GLOBAL_DIP_PERCENTAGE = 100; // Temporarily set to 100 for testing buy logic

/** Each trade will be for this amount in USD. */
export const GLOBAL_BUY_AMOUNT_USD = 50;

/** Activate trailing stop when profit reaches this percentage (e.g., 2.5 for 2.5%). */
export const GLOBAL_TRAIL_ACTIVATION_PROFIT = 2.5;

/** Trailing stop loss distance from the high price, as a percentage (e.g., 0.8 for 0.8%). */
export const GLOBAL_TRAIL_DELTA = 0.8;

/**
 * List of market symbols the bot and dashboard will monitor.
 * IMPORTANT: Verify these symbols are active on the Binance Testnet environment you are using.
 * Invalid symbols will cause API errors. This list is a common starting point.
 */
export const MONITORED_MARKET_SYMBOLS = [
    // Core USDT Pairs (commonly available on Testnet)
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "XRPUSDT", "SOLUSDT",
    "LTCUSDT", "LINKUSDT", "DOGEUSDT",
    // Common BTC Pairs (less likely to be an issue than obscure alt/USDT pairs)
    "ETHBTC", "BNBBTC", "ADABTC", "XRPBTC", "LTCBTC", "LINKBTC"
    // Removed symbols like MATICUSDT, FTMUSDT, SHIBUSDT, etc., which are often problematic on Testnet.
    // Add symbols back cautiously and test.
];

/**
 * Object exporting all global bot settings for easy import.
 */
export const BOT_GLOBAL_SETTINGS = {
    GLOBAL_DIP_PERCENTAGE,
    GLOBAL_BUY_AMOUNT_USD,
    GLOBAL_TRAIL_ACTIVATION_PROFIT,
    GLOBAL_TRAIL_DELTA,
    MONITORED_MARKET_SYMBOLS,
};
