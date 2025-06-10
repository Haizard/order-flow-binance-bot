
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  // FormDescription, // No longer needed for removed fields
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
// import { Switch } from "@/components/ui/switch"; // No longer needed for isBotActive
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// import { Separator } from "@/components/ui/separator"; // No longer needed
import { AlertCircle, KeyRound, CheckCircle, Loader2, Save } from "lucide-react"; // Bot, SlidersHorizontal, Zap removed
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { getAccountInformation } from "@/services/binance";
import { getSettings, saveSettings } from "@/services/settingsService";
import { defaultSettingsValues } from "@/config/settings-defaults";

// Placeholder for current user ID - replace with actual auth system integration
const DEMO_USER_ID = "user123";

// Schema now only includes userId and API keys.
const settingsFormSchema = z.object({
  userId: z.string().min(1, "User ID is required."),
  binanceApiKey: z.string().optional(),
  binanceSecretKey: z.string().optional(),
  // Removed: buyAmountUsd, dipPercentage, trailActivationProfit, trailDelta, isBotActive
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
    defaultValues: formDefaultValues,
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
        const savedSettings = await getSettings(DEMO_USER_ID); // getSettings now ensures defaults if not found
        form.reset(savedSettings); // Reset with potentially just API keys or full defaults if new
        console.log(`[${new Date().toISOString()}] SettingsForm: Settings loaded and form reset for user ${DEMO_USER_ID}.`, savedSettings);
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
    console.log(`[${new Date().toISOString()}] SettingsForm: Attempting to save settings for user ${data.userId}:`, data);
    try {
      // Ensure only relevant fields are saved.
      // The form data 'data' already matches the simplified SettingsFormValues.
      await saveSettings(data.userId, data);
      toast({
        title: "API Keys Saved!",
        description: "Your Binance API Keys have been successfully saved.",
        variant: "default",
        className: "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700 text-green-800 dark:text-green-300",
      });
      console.log(`[${new Date().toISOString()}] SettingsForm: Settings saved successfully for user ${data.userId}.`);
    } catch (error)
    {
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
        <p className="text-muted-foreground">Loading API Key settings...</p>
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
              These keys will be used by the bot to trade on your behalf.
              Ensure API keys have trading permissions but NOT withdrawal permissions.
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

        {/* Removed Bot Configuration Card and Bot Status Card sections */}

        <Button type="submit" size="lg" className="w-full md:w-auto" disabled={isSaving || isTestingConnection}>
          {isSaving ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Save className="mr-2 h-5 w-5" />
          )}
          Save My API Keys
        </Button>
      </form>
    </Form>
  );
}
