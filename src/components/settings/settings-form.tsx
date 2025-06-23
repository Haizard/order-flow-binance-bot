
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, KeyRound, CheckCircle, Loader2, Save, Zap, ShieldAlert, Trash2, TriangleAlert, SlidersHorizontal } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getAccountInformation } from "@/services/binance";
import { getSettings, saveSettings } from "@/services/settingsService";
import { defaultSettingsValues, defaultMonitoredSymbols } from "@/config/settings-defaults";
import { handleClearUserTrades } from "@/app/(app)/settings/actions";


// Placeholder for current user ID - replace with actual auth system integration
const DEMO_USER_ID = "user123";

const settingsFormSchema = z.object({
  userId: z.string().min(1, "User ID is required."),
  binanceApiKey: z.string().optional(),
  binanceSecretKey: z.string().optional(),
  // New symbols field
  monitoredSymbols: z.string().min(1, "At least one symbol is required."),
  // Basic Strategy
  dipPercentage: z.coerce.number()
    .max(0, "Dip percentage should be 0 or negative (e.g., -5 for a 5% dip).")
    .min(-100, "Dip percentage cannot be less than -100.")
    .optional(),
  buyAmountUsd: z.coerce.number()
    .positive("Buy amount must be a positive number.")
    .optional(),
  trailActivationProfit: z.coerce.number()
    .positive("Trail activation profit must be a positive percentage.")
    .optional(),
  trailDelta: z.coerce.number()
    .positive("Trail delta must be a positive percentage.")
    .max(100, "Trail delta cannot exceed 100%.")
    .optional(),
  maxActiveTrades: z.coerce.number()
    .int("Max active trades must be a whole number.")
    .positive("Max active trades must be a positive number.")
    .optional(),
  // Advanced Strategy
  initialStopLossPercentage: z.coerce.number()
    .positive("Initial stop loss must be a positive percentage.")
    .optional(),
  valueAreaPercentage: z.coerce.number()
    .min(1, "Value area must be at least 1%.")
    .max(99, "Value area cannot exceed 99%.")
    .int("Value area must be a whole number.")
    .optional(),
  imbalanceRatioThreshold: z.coerce.number()
    .min(1, "Imbalance ratio must be at least 1 (100%).")
    .positive("Imbalance ratio must be positive.")
    .optional(),
  stackedImbalanceCount: z.coerce.number()
    .min(1, "Stacked imbalance count must be at least 1.")
    .int("Stacked imbalance count must be a whole number.")
    .optional(),
  swingLookaroundWindow: z.coerce.number()
    .min(1, "Swing lookaround window must be at least 1.")
    .int("Swing lookaround window must be a whole number.")
    .optional(),
  minBarsForDivergence: z.coerce.number()
    .min(3, "Minimum bars for divergence must be at least 3.")
    .int("Minimum bars for divergence must be a whole number.")
    .optional(),
});

export type SettingsFormValues = Omit<z.infer<typeof settingsFormSchema>, 'monitoredSymbols'> & {
  monitoredSymbols: string[];
};
type FormSchemaType = z.infer<typeof settingsFormSchema>;


export function SettingsForm() {
  const form = useForm<FormSchemaType>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
       ...defaultSettingsValues,
       userId: DEMO_USER_ID,
       monitoredSymbols: defaultMonitoredSymbols.join(', '),
     },
    mode: "onChange",
  });

  const { toast } = useToast();
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearingTrades, setIsClearingTrades] = useState(false);
  const [isDevelopmentEnv, setIsDevelopmentEnv] = useState(false);

  useEffect(() => {
    setIsDevelopmentEnv(process.env.NODE_ENV === 'development');

    async function loadSettings() {
      setIsLoadingSettings(true);
      try {
        const savedSettings = await getSettings(DEMO_USER_ID);
        const fullDefaultsWithUserId = {
             ...defaultSettingsValues,
             userId: DEMO_USER_ID,
             monitoredSymbols: defaultMonitoredSymbols.join(', '),
        };
        const settingsForForm = {
            ...fullDefaultsWithUserId,
            ...savedSettings,
            monitoredSymbols: (savedSettings.monitoredSymbols && savedSettings.monitoredSymbols.length > 0)
              ? savedSettings.monitoredSymbols.join(', ')
              : defaultMonitoredSymbols.join(', '),
        };
        form.reset(settingsForForm);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] SettingsForm: Failed to load settings for user ${DEMO_USER_ID}:`, error);
        toast({
          title: "Error Loading Settings",
          description: "Could not load your saved settings. Using defaults.",
          variant: "destructive",
        });
        form.reset({
            ...defaultSettingsValues,
            userId: DEMO_USER_ID,
            monitoredSymbols: defaultMonitoredSymbols.join(', '),
        });
      } finally {
        setIsLoadingSettings(false);
      }
    }
    loadSettings();
  }, [form, toast]);

  async function handleTestConnection() {
    const { binanceApiKey, binanceSecretKey } = form.getValues();
    if (!binanceApiKey || !binanceSecretKey) {
        toast({
            title: "API Keys Required",
            description: "Please enter both API Key and Secret Key to test the connection.",
            variant: "destructive",
        });
        return;
    }
    setIsTestingConnection(true);
    try {
      const accountInfo = await getAccountInformation(binanceApiKey, binanceSecretKey);
      toast({
        title: "Connection Successful!",
        description: `Successfully connected to Binance. Account type: ${accountInfo.accountType}.`,
        variant: "default",
        className: "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700 text-green-800 dark:text-green-300",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  }

  async function onSubmit(data: FormSchemaType) {
    setIsSaving(true);

    const symbolsArray = data.monitoredSymbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    const settingsToSave: SettingsFormValues = {
        ...data,
        monitoredSymbols: symbolsArray,
    };
    
    // Coerce all numeric fields to ensure they are saved as numbers, using defaults as fallbacks.
    Object.keys(defaultSettingsValues).forEach(key => {
        const formValue = data[key as keyof FormSchemaType];
        const defaultValue = defaultSettingsValues[key as keyof typeof defaultSettingsValues];
        
        if (typeof defaultValue === 'number') {
            (settingsToSave as any)[key] = formValue !== undefined && formValue !== '' ? Number(formValue) : defaultValue;
        }
    });

    try {
      await saveSettings(data.userId, settingsToSave);
      toast({
        title: "Settings Saved!",
        description: "Your API Keys and Bot Strategy have been successfully saved.",
        variant: "default",
        className: "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700 text-green-800 dark:text-green-300",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while saving.";
      toast({
        title: "Save Failed",
        description: `Could not save settings: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function onClearTradesConfirm() {
    setIsClearingTrades(true);
    const result = await handleClearUserTrades(DEMO_USER_ID);
    if (result.success) {
      toast({
        title: "Trades Cleared",
        description: result.message,
        variant: "default",
        className: "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700 text-green-800 dark:text-green-300",
      });
    } else {
      toast({
        title: "Clearing Failed",
        description: result.message + (result.error ? ` Error: ${result.error}` : ''),
        variant: "destructive",
      });
    }
    setIsClearingTrades(false);
  }

  if (isLoadingSettings) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <KeyRound className="h-6 w-6 text-primary" />
              Binance API Connection
            </CardTitle>
            <CardDescription>
              Connect your Binance account by providing your API Key and Secret Key.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
              <AlertCircle className="h-5 w-5 text-primary" />
              <AlertTitle className="text-primary font-semibold">Important Security Notice</AlertTitle>
              <AlertDescription>
                Store API keys securely. Grant minimal permissions: Enable Spot & Margin Trading only. DO NOT enable withdrawals.
                API keys entered here are saved to your user-specific settings in the database.
              </AlertDescription>
            </Alert>
            <FormField
              control={form.control}
              name="binanceApiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Binance API Key</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your Binance API Key" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="binanceSecretKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Binance Secret Key</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Enter your Binance Secret Key" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              onClick={handleTestConnection}
              disabled={isTestingConnection || isSaving || isLoadingSettings}
              variant="outline"
              className="w-full md:w-auto"
            >
              {isTestingConnection ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-5 w-5" />
              )}
              Test My Connection
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <Zap className="h-6 w-6 text-primary" />
              Core Trading Strategy
            </CardTitle>
            <CardDescription>
              Configure the primary risk and trade management parameters for your trading bot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <Alert variant="default" className="bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
                <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-amber-700 dark:text-amber-300 font-semibold">Strategy Impact</AlertTitle>
                <AlertDescription>
                    These settings directly control trading decisions. Incorrect values can lead to unintended trades or losses.
                    Ensure you understand each parameter.
                </AlertDescription>
            </Alert>
            <FormField
              control={form.control}
              name="monitoredSymbols"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monitored Symbols</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., BTCUSDT,ETHUSDT,SOLUSDT"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Comma-separated list of symbols for the bot to monitor. Ensure they exist on Binance Testnet.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="buyAmountUsd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trade Size (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="50" {...field} value={field.value ?? ""} step="1" />
                    </FormControl>
                    <FormDescription>Amount in USD for each new trade.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxActiveTrades"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Concurrent Trades</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="3" {...field} value={field.value ?? ""} step="1" />
                    </FormControl>
                    <FormDescription>Max number of trades open at once.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="initialStopLossPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Stop Loss (%)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="1.5" {...field} value={field.value ?? ""} step="0.1" />
                    </FormControl>
                    <FormDescription>Initial risk limit for new trades.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dipPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dip % Pre-filter (≤ 0)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="-4" {...field} value={field.value ?? ""} step="0.1" />
                    </FormControl>
                    <FormDescription>Pre-scan filter for potential buys.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="trailActivationProfit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trail Activation Profit (%)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="2.5" {...field} value={field.value ?? ""} step="0.1" />
                    </FormControl>
                    <FormDescription>Profit % to start trailing stop.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="trailDelta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trailing Stop Delta (%)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.8" {...field} value={field.value ?? ""} step="0.1" />
                    </FormControl>
                    <FormDescription>Distance from peak for trailing stop.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
           <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <SlidersHorizontal className="h-6 w-6 text-primary" />
              Advanced Order Flow Parameters
            </CardTitle>
            <CardDescription>
              Fine-tune the technical parameters used for order flow analysis. Adjust with care.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                  control={form.control}
                  name="valueAreaPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Value Area Percentage</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="70" {...field} value={field.value ?? ""} step="1" />
                      </FormControl>
                      <FormDescription>The volume % used to calculate VAH/VAL.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="imbalanceRatioThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Imbalance Ratio (e.g., 3 for 300%)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="3" {...field} value={field.value ?? ""} step="0.1" />
                      </FormControl>
                      <FormDescription>Bid vs. Ask volume ratio to flag imbalance.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stackedImbalanceCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stacked Imbalance Count</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="2" {...field} value={field.value ?? ""} step="1" />
                      </FormControl>
                      <FormDescription>Number of stacked levels for reversal signal.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="swingLookaroundWindow"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Divergence Swing Window</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="2" {...field} value={field.value ?? ""} step="1" />
                      </FormControl>
                      <FormDescription>Bars to look left/right for swing points.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="minBarsForDivergence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Bars for Divergence Calc</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="10" {...field} value={field.value ?? ""} step="1" />
                      </FormControl>
                      <FormDescription>Minimum bars required for divergence signal.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full md:w-auto" disabled={isSaving || isTestingConnection || isLoadingSettings || isClearingTrades}>
          {isSaving ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Save className="mr-2 h-5 w-5" />
          )}
          Save All Settings
        </Button>

        {isDevelopmentEnv && (
          <Card className="shadow-lg border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-headline text-destructive">
                <TriangleAlert className="h-6 w-6" />
                Developer Options
              </CardTitle>
              <CardDescription>
                These tools are for development and testing purposes only. Use with caution.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full md:w-auto" disabled={isClearingTrades || isSaving}>
                    {isClearingTrades ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-5 w-5" />
                    )}
                    Clear My Trades Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action will permanently delete all trade history and active trades for your user ({DEMO_USER_ID}). This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isClearingTrades}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onClearTradesConfirm}
                      disabled={isClearingTrades}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {isClearingTrades ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Yes, Clear Data
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <FormDescription className="mt-2 text-xs">
                This button is only visible in development mode. It calls a server action to clear trades for '{DEMO_USER_ID}'.
              </FormDescription>
            </CardContent>
          </Card>
        )}
      </form>
    </Form>
  );
}
