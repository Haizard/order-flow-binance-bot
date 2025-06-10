
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, KeyRound, Bot, SlidersHorizontal, Zap, CheckCircle, AlertTriangle, Loader2, Save } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { getAccountInformation } from "@/services/binance";
// import type { AccountInformation } from "@/types/binance";
import { getSettings, saveSettings } from "@/services/settingsService";
import { defaultSettingsValues } from "@/config/settings-defaults"; // Import new defaults

// Placeholder for current user ID - replace with actual auth system integration
const DEMO_USER_ID = "user123";

const settingsFormSchema = z.object({
  userId: z.string().min(1, "User ID is required."),
  binanceApiKey: z.string().optional(),
  binanceSecretKey: z.string().optional(),
  buyAmountUsd: z.coerce.number().positive("Buy amount must be positive."),
  dipPercentage: z.coerce.number().min(-100, "Dip % too low").max(0, "Dip % must be negative or zero."),
  trailActivationProfit: z.coerce.number().positive("Trail activation profit must be positive."),
  trailDelta: z.coerce.number().positive("Trail delta must be positive.").max(50, "Trail delta too high (max 50%)."),
  isBotActive: z.boolean().default(false),
});

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;

// Use the imported defaults for initializing the form's default values.
// The userId is added separately.
export const formDefaultValues: SettingsFormValues = {
  ...defaultSettingsValues,
  userId: DEMO_USER_ID, // This will be overridden by loaded settings or kept for new user
};


export function SettingsForm() {
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: formDefaultValues, // Use the full default structure
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
        // getSettings now guarantees returning SettingsFormValues (with defaults if new)
        const savedSettings = await getSettings(DEMO_USER_ID);
        form.reset(savedSettings);
        console.log(`[${new Date().toISOString()}] SettingsForm: Settings loaded and form reset for user ${DEMO_USER_ID}.`, savedSettings);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] SettingsForm: Failed to load settings for user ${DEMO_USER_ID}:`, error);
        toast({
          title: "Error Loading Settings",
          description: "Could not load your saved settings. Using defaults.",
          variant: "destructive",
        });
        // Fallback to formDefaultValues if loading fails
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
    console.log(`[${new Date().toISOString()}] SettingsForm: Attempting to save settings for user ${data.userId}:`, data);
    try {
      await saveSettings(data.userId, data);
      toast({
        title: "Settings Saved!",
        description: "Your bot configurations have been successfully saved.",
        variant: "default",
        className: "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700 text-green-800 dark:text-green-300",
      });
      console.log(`[${new Date().toISOString()}] SettingsForm: Settings saved successfully for user ${data.userId}.`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] SettingsForm: Error saving settings for user ${data.userId}:`, error);
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
              Binance API Connection (For Your Account)
            </CardTitle>
            <CardDescription>
              Connect your Binance account. These keys will be used for trading on your behalf.
              Ensure API keys have trading permissions but NOT withdrawal permissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
              <AlertCircle className="h-5 w-5 text-primary" />
              <AlertTitle className="text-primary font-semibold">Important Security Notice</AlertTitle>
              <AlertDescription>
                Store API keys securely. For production, consider a dedicated secret manager.
                Grant minimal permissions: Enable Spot & Margin Trading only. DO NOT enable withdrawals.
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
              disabled={isTestingConnection || isSaving}
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

        <Separator />

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <SlidersHorizontal className="h-6 w-6 text-primary" />
              Your Bot Configuration
            </CardTitle>
            <CardDescription>
              Define the parameters for your "Dip & Trail" trading strategy. These settings are specific to your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="buyAmountUsd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buy Amount (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 100" {...field} />
                    </FormControl>
                    <FormDescription>Amount in USD for each new trade on your account.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dipPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dip Percentage (%)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., -4" {...field} />
                    </FormControl>
                    <FormDescription>Bot will consider buying for you when 24hr change is ≤ this value.</FormDescription>
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
                      <Input type="number" placeholder="e.g., 3" {...field} />
                    </FormControl>
                    <FormDescription>Activate trailing stop loss for your trades at this profit %.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="trailDelta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trail Delta (%)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 1" {...field} />
                    </FormControl>
                    <FormDescription>Trailing stop loss distance for your trades.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Separator />

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <Bot className="h-6 w-6 text-primary" />
              Your Bot Status
            </CardTitle>
            <CardDescription>
              Enable or disable the trading bot for your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="isBotActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Activate Bot For My Account</FormLabel>
                    <FormDescription>
                      Turn the trading bot on or off for your Binance account.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSaving}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full md:w-auto" disabled={isSaving || isTestingConnection}>
          {isSaving ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Save className="mr-2 h-5 w-5" />
          )}
          Save My Settings
        </Button>
      </form>
    </Form>
  );
}
