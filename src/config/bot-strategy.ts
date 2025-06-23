
/**
 * @fileOverview Static configuration for the bot. User-specific strategy parameters are managed via settingsService.
 */

/**
 * List of market symbols the bot and dashboard will monitor.
 * IMPORTANT: Verify these symbols are active on the Binance Testnet environment you are using.
 * Invalid symbols will cause API errors. This list is a common starting point.
 */
export const MONITORED_MARKET_SYMBOLS = [
    // Core USDT Pairs (commonly available on Testnet)
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "XRPUSDT", "SOLUSDT",
    "LTCUSDT", "LINKUSDT", "DOGEUSDT",
    // Common BTC Pairs
    "ETHBTC", "BNBBTC", "ADABTC", "XRPBTC", "LTCBTC", "LINKBTC"
    // Removed symbols like MATICUSDT, FTMUSDT, SHIBUSDT, etc., based on previous errors.
    // Add symbols back cautiously and test their availability on Testnet.
];
