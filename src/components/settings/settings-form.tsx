
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, KeyRound, CheckCircle, Loader2, Save, TrendingDown, DollarSign, Zap, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { getAccountInformation } from "@/services/binance";
import { getSettings, saveSettings } from "@/services/settingsService";
import { defaultSettingsValues } from "@/config/settings-defaults";
import { Separator } from "@/components/ui/separator";

// Placeholder for current user ID - replace with actual auth system integration
const DEMO_USER_ID = "user123";

const settingsFormSchema = z.object({
  userId: z.string().min(1, "User ID is required."),
  binanceApiKey: z.string().optional(),
  binanceSecretKey: z.string().optional(),
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
});

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;

// formDefaultValues will be sourced from settings-defaults.ts via getSettings on load
// This const is primarily for structure reference here.
export const formDefaultValuesReference: Omit<SettingsFormValues, 'userId'> = {
  ...defaultSettingsValues, // This ensures all fields, including new strategy params, have defaults
};

export function SettingsForm() {
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: { ...defaultSettingsValues, userId: DEMO_USER_ID },
    mode: "onChange",
  });

  const { toast } = useToast();
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      setIsLoadingSettings(true);
      try {
        console.log(`[${new Date().toISOString()}] SettingsForm: Attempting to load settings for user: ${DEMO_USER_ID}...`);
        const savedSettings = await getSettings(DEMO_USER_ID);
        // Ensure all form fields, including new ones, get default values if not present in savedSettings
        const fullDefaultsWithUserId = { ...defaultSettingsValues, userId: DEMO_USER_ID };
        form.reset({ ...fullDefaultsWithUserId, ...savedSettings }); 
        console.log(`[${new Date().toISOString()}] SettingsForm: Settings loaded and form reset for user ${DEMO_USER_ID}. API Key present: ${!!savedSettings.binanceApiKey}, Dip Percentage: ${savedSettings.dipPercentage}`);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] SettingsForm: Failed to load settings for user ${DEMO_USER_ID}:`, error);
        toast({
          title: "Error Loading Settings",
          description: "Could not load your saved settings. Using defaults.",
          variant: "destructive",
        });
        form.reset({ ...defaultSettingsValues, userId: DEMO_USER_ID });
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

  async function onSubmit(data: SettingsFormValues) {
    setIsSaving(true);
    const settingsToSave = {
        ...data,
        // Ensure numeric fields are actually numbers if they came from coerce
        dipPercentage: data.dipPercentage !== undefined ? Number(data.dipPercentage) : defaultSettingsValues.dipPercentage,
        buyAmountUsd: data.buyAmountUsd !== undefined ? Number(data.buyAmountUsd) : defaultSettingsValues.buyAmountUsd,
        trailActivationProfit: data.trailActivationProfit !== undefined ? Number(data.trailActivationProfit) : defaultSettingsValues.trailActivationProfit,
        trailDelta: data.trailDelta !== undefined ? Number(data.trailDelta) : defaultSettingsValues.trailDelta,
    };

    console.log(`[${new Date().toISOString()}] SettingsForm: Submitting data to saveSettings:`, JSON.stringify({
        userId: settingsToSave.userId, 
        apiKeyLength: settingsToSave.binanceApiKey?.length || 0, 
        secretKeyLength: settingsToSave.binanceSecretKey?.length || 0,
        dipPercentage: settingsToSave.dipPercentage,
        buyAmountUsd: settingsToSave.buyAmountUsd,
        trailActivationProfit: settingsToSave.trailActivationProfit,
        trailDelta: settingsToSave.trailDelta,
    }));
    
    try {
      await saveSettings(settingsToSave.userId, settingsToSave);
      toast({
        title: "Settings Saved!",
        description: "Your API Keys and Bot Strategy have been successfully saved.",
        variant: "default",
        className: "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700 text-green-800 dark:text-green-300",
      });
       console.log(`[${new Date().toISOString()}] SettingsForm: Settings presumed saved successfully for user ${settingsToSave.userId}.`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] SettingsForm: Error saving settings for user ${settingsToSave.userId}:`, error);
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
              Bot Trading Strategy
            </CardTitle>
            <CardDescription>
              Configure the core parameters for your trading bot. These settings define when the bot buys and sells.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <Alert variant="default" className="bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
                <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-amber-700 dark:text-amber-300 font-semibold">Strategy Impact</AlertTitle>
                <AlertDescription>
                    These settings directly control trading decisions. Incorrect values can lead to unintended trades or losses.
                    Ensure you understand each parameter. Values are saved per user.
                </AlertDescription>
            </Alert>
            <FormField
              control={form.control}
              name="dipPercentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dip Percentage for Buy (-1 to -100)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="-4" {...field} value={field.value ?? ""} step="0.1" />
                  </FormControl>
                  <FormDescription>
                    Bot buys if 24hr price change is ≤ this value (e.g., -4 for -4%).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="buyAmountUsd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Buy Amount (USD)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="50" {...field} value={field.value ?? ""} step="1" />
                  </FormControl>
                  <FormDescription>
                    Amount in USD for each trade the bot initiates.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="trailActivationProfit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trailing Stop Activation Profit (%)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="2.5" {...field} value={field.value ?? ""} step="0.1" />
                  </FormControl>
                  <FormDescription>
                    Trailing stop activates when profit reaches this percentage (e.g., 2.5 for 2.5%).
                  </FormDescription>
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
                  <FormDescription>
                    Trailing stop loss distance from high price (e.g., 0.8 for 0.8%).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>


        <Button type="submit" size="lg" className="w-full md:w-auto" disabled={isSaving || isTestingConnection || isLoadingSettings}>
          {isSaving ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Save className="mr-2 h-5 w-5" />
          )}
          Save All Settings
        </Button>
      </form>
    </Form>
  );
}
