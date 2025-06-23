
import type { SettingsFormValues } from '@/components/settings/settings-form';

// Defines the base default values for user settings.
// Excludes userId, which is added dynamically.
export const defaultSettingsValues: Omit<SettingsFormValues, 'userId'> = {
  binanceApiKey: "",
  binanceSecretKey: "",
  // Bot strategy defaults
  dipPercentage: -4,
  buyAmountUsd: 50,
  trailActivationProfit: 2.5,
  trailDelta: 0.8,
  maxActiveTrades: 3,
  // --- New Advanced Parameters ---
  initialStopLossPercentage: 1.5, // %
  valueAreaPercentage: 70, // %
  imbalanceRatioThreshold: 3, // e.g., 3 means 300%
  stackedImbalanceCount: 2,
  swingLookaroundWindow: 2,
  minBarsForDivergence: 10,
};
