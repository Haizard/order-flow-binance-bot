
/**
 * @fileOverview Static configuration for the bot. User-specific strategy parameters are managed via settingsService.
 */

/**
 * List of market symbols the bot and dashboard will monitor.
 * IMPORTANT: Verify these symbols are active on the Binance Testnet environment you are using.
 * Invalid symbols will cause API errors. This list is a common starting point.
 */
export const MONITORED_MARKET_SYMBOLS = [
    // Core Crypto USDT Pairs (commonly available on Testnet)
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "XRPUSDT", "SOLUSDT",
    "LTCUSDT", "LINKUSDT", "DOGEUSDT",
    // Example Forex Pairs (if available on the stream)
    "EURUSDT", "GBPUSDT",
    // Common BTC Pairs
    "ETHBTC", "BNBBTC", "ADABTC", "XRPBTC", "LTCBTC", "LINKBTC"
];
