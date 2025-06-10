
// --- GLOBAL BOT STRATEGY PARAMETERS ---
// These are centrally managed for the entire bot's operation.

/** Bot considers buying if 24hr change is less than or equal to this percentage (e.g., -5 for -5%). */
export const GLOBAL_DIP_PERCENTAGE = -4; // Adjusted to 4% as per user's example in prompt

/** Each trade will be for this amount in USD. */
export const GLOBAL_BUY_AMOUNT_USD = 50;

/** Activate trailing stop when profit reaches this percentage (e.g., 2.5 for 2.5%). */
export const GLOBAL_TRAIL_ACTIVATION_PROFIT = 2.5;

/** Trailing stop loss distance from the high price, as a percentage (e.g., 0.8 for 0.8%). */
export const GLOBAL_TRAIL_DELTA = 0.8;

/**
 * List of market symbols the bot and dashboard will monitor.
 * Expanded to include more major coins against USDT and some BTC pairs.
 */
export const MONITORED_MARKET_SYMBOLS = [
    // Core USDT Pairs
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "XRPUSDT", "SOLUSDT",
    // Additional Major USDT Pairs
    "DOTUSDT", "DOGEUSDT", "SHIBUSDT", "LTCUSDT", "LINKUSDT",
    "MATICUSDT", "AVAXUSDT", "ATOMUSDT", "UNIUSDT", "TRXUSDT",
    "ETCUSDT", "BCHUSDT", "XLMUSDT", "ICPUSDT", "FILUSDT",
    "NEARUSDT", "ALGOUSDT", "VETUSDT", "FTMUSDT", "HBARUSDT",
    // Selected BTC Pairs for major coins
    "ETHBTC", "BNBBTC", "ADABTC", "SOLBTC", "XRPBTC",
    "DOTBTC", "LTCBTC", "LINKBTC", "MATICBTC", "AVAXBTC"
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

