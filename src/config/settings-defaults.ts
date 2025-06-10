
import type { SettingsFormValues } from '@/components/settings/settings-form';

// Defines the base default values for user settings, now primarily API keys.
// Excludes userId, which is added dynamically.
export const defaultSettingsValues: Omit<SettingsFormValues, 'userId'> = {
  binanceApiKey: "",
  binanceSecretKey: "",
  // Bot-specific parameters like buyAmountUsd, dipPercentage, etc., are now global
  // and managed within core/bot.ts or by an admin.
  // isBotActive is also removed from user settings; activity will depend on API keys provided
  // and, in a full system, subscription status.
};

