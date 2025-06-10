
import type { SettingsFormValues } from '@/components/settings/settings-form';

// Defines the base default values for bot settings, excluding userId.
export const defaultSettingsValues: Omit<SettingsFormValues, 'userId'> = {
  binanceApiKey: "",
  binanceSecretKey: "",
  buyAmountUsd: 100,
  dipPercentage: -4,
  trailActivationProfit: 3,
  trailDelta: 1,
  isBotActive: false,
};
