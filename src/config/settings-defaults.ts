
import type { SettingsFormValues } from '@/components/settings/settings-form';

// Defines the base default values for user settings.
// Excludes userId, which is added dynamically.
export const defaultSettingsValues: Omit<SettingsFormValues, 'userId'> = {
  binanceApiKey: "",
  binanceSecretKey: "",
  // Bot strategy defaults - these will be used if a user hasn't configured their own.
  // Values are taken from the original bot-strategy.ts global constants.
  dipPercentage: -4, // Default dip percentage to consider for buys
  buyAmountUsd: 50,    // Default amount in USD for each trade
  trailActivationProfit: 2.5, // Default profit % to activate trailing stop
  trailDelta: 0.8,      // Default trailing stop loss delta %
  maxActiveTrades: 3,     // Default maximum number of concurrent trades
};
