import type { SettingsFormValues } from '@/components/settings/settings-form';

// The default list of symbols the bot will monitor. This can be changed by the user in settings.
export const defaultMonitoredSymbols = [
    // Core Crypto USDT Pairs (commonly available on Testnet)
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "XRPUSDT", "SOLUSDT",
    "LTCUSDT", "LINKUSDT", "DOGEUSDT"
];

// Defines the base default values for user settings.
// Excludes userId, which is added dynamically.
export const defaultSettingsValues: Omit<SettingsFormValues, 'userId'> = {
  hasActiveSubscription: false, // Default to not subscribed
  monitoredSymbols: defaultMonitoredSymbols,
  binanceApiKey: "",
  binanceSecretKey: "",
  // Bot strategy defaults
  useDynamicSizing: false, // Default to fixed size
  riskPercentage: 1, // Default risk 1% of account balance
  buyAmountUsd: 50, // Fallback fixed trade size
  dipPercentage: -4,
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
