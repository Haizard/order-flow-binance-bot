import type { SettingsFormValues } from '@/components/settings/settings-form';

// The default list of symbols the bot will monitor. This can be changed by the user in settings.
export const defaultMonitoredSymbols = [
    // Core Crypto USDT Pairs (commonly available on Testnet)
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "XRPUSDT", "SOLUSDT",
    "LTCUSDT", "LINKUSDT", "DOGEUSDT",
    // Example Forex Pairs (if available on the stream)
    "EURUSDT", "GBPUSDT",
    // Common BTC Pairs
    "ETHBTC", "BNBBTC", "ADABTC", "XRPBTC", "LTCBTC", "LINKBTC"
];

// Defines the base default values for user settings.
// Excludes userId, which is added dynamically.
export const defaultSettingsValues: Omit<SettingsFormValues, 'userId'> = {
  hasActiveSubscription: false, // Default to not subscribed
  monitoredSymbols: defaultMonitoredSymbols,
  binanceApiKey: "",
  binanceSecretKey: "",
  // Bot strategy defaults
  dipPercentage: -4,
  buyAmountUsd: 50,
  trailActivationProfit: 2.5,
  trailDelta: 0.8,
  maxActiveTrades: 3,
  // --- Advanced Parameters ---
  initialStopLossPercentage: 1.5, // %
  valueAreaPercentage: 70, // %
  imbalanceRatioThreshold: 3, // e.g., 3 means 300%
  stackedImbalanceCount: 2,
  swingLookaroundWindow: 2,
  minBarsForDivergence: 10,
};
