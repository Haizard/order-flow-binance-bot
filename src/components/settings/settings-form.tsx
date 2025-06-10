
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState } from 'react';
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
import { AlertCircle, KeyRound, Bot, SlidersHorizontal, Zap, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { getAccountInformation } from "@/services/binance";
import type { AccountInformation } from "@/types/binance";

const settingsFormSchema = z.object({
  binanceApiKey: z.string().optional(), // Made optional as .env can be a source
  binanceSecretKey: z.string().optional(), // Made optional
  buyAmountUsd: z.coerce.number().positive("Buy amount must be positive."),
  dipPercentage: z.coerce.number().min(-100, "Dip % too low").max(0, "Dip % must be negative or zero."),
  trailActivationProfit: z.coerce.number().positive("Trail activation profit must be positive."),
  trailDelta: z.coerce.number().positive("Trail delta must be positive.").max(50, "Trail delta too high (max 50%)."),
  isBotActive: z.boolean().default(false),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

const defaultValues: Partial<SettingsFormValues> = {
  binanceApiKey: "",
  binanceSecretKey: "",
  buyAmountUsd: 100,
  dipPercentage: -4,
  trailActivationProfit: 3,
  trailDelta: 1,
  isBotActive: false,
};

export function SettingsForm() {
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues,
    mode: "onChange",
  });

  const { toast } = useToast();
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  async function handleTestConnection() {
    const { binanceApiKey, binanceSecretKey } = form.getValues();
    setIsTestingConnection(true);
    try {
      // Call getAccountInformation. It will use form values if provided,
      // otherwise it will attempt to use environment variables.
      // If both are missing, it will throw an error.
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

  function onSubmit(data: SettingsFormValues) {
    console.log("Saving settings:", data);
    // Here you would typically save data.binanceApiKey and data.binanceSecretKey 
    // to a secure backend if the user intends to persist them via the form,
    // separate from .env configurations.
    // For now, we just log and toast.
    toast({ title: "Settings Action", description: "Settings form submitted. API keys from form (if any) are logged." });
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
              Connect your Binance account. Keys can be set in your <code>.env.local</code> file (recommended) or entered below.
              Ensure API keys have trading permissions but NOT withdrawal permissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
              <AlertCircle className="h-5 w-5 text-primary" />
              <AlertTitle className="text-primary font-semibold">Important Security Notice</AlertTitle>
              <AlertDescription>
                For production, store API keys securely (e.g., <code>.env.local</code> or secret manager) and grant minimal permissions: Enable Spot & Margin Trading only. DO NOT enable withdrawals.
              </AlertDescription>
            </Alert>
            <FormField
              control={form.control}
              name="binanceApiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Binance API Key (Optional if in .env.local)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your Binance API Key" {...field} />
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
                  <FormLabel>Binance Secret Key (Optional if in .env.local)</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Enter your Binance Secret Key" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="button" 
              onClick={handleTestConnection} 
              disabled={isTestingConnection}
              variant="outline"
              className="w-full md:w-auto"
            >
              {isTestingConnection ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-5 w-5" />
              )}
              Test Connection
            </Button>
          </CardContent>
        </Card>

        <Separator />

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <SlidersHorizontal className="h-6 w-6 text-primary" />
              Bot Configuration
            </CardTitle>
            <CardDescription>
              Define the parameters for your "Dip & Trail" trading strategy.
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
                    <FormDescription>Amount in USD for each new trade.</FormDescription>
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
                    <FormDescription>Buy when 24hr change is ≤ this value (e.g. -4 for -4%).</FormDescription>
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
                    <FormDescription>Activate trailing stop loss at this profit % (e.g. 3 for +3%).</FormDescription>
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
                    <FormDescription>Trailing stop loss distance from highest price (e.g. 1 for 1%).</FormDescription>
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
              Bot Status
            </CardTitle>
            <CardDescription>
              Enable or disable the trading bot.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="isBotActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Activate Bot</FormLabel>
                    <FormDescription>
                      Turn the trading bot on or off. Changes will apply on the next cycle.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full md:w-auto">
          <Zap className="mr-2 h-5 w-5" /> Save All Settings
        </Button>
      </form>
    </Form>
  );
}
