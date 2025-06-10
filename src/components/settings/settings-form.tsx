"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
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
import { AlertCircle, KeyRound, Bot, SlidersHorizontal, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const settingsFormSchema = z.object({
  binanceApiKey: z.string().min(1, "API Key is required."),
  binanceSecretKey: z.string().min(1, "Secret Key is required."),
  buyAmountUsd: z.coerce.number().positive("Buy amount must be positive."),
  dipPercentage: z.coerce.number().min(-100, "Dip % too low").max(0, "Dip % must be negative or zero."),
  trailActivationProfit: z.coerce.number().positive("Trail activation profit must be positive."),
  trailDelta: z.coerce.number().positive("Trail delta must be positive.").max(50, "Trail delta too high (max 50%)."),
  isBotActive: z.boolean().default(false),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

// Placeholder default values, in a real app these would come from user's saved settings
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

  function onSubmit(data: SettingsFormValues) {
    // Handle form submission (e.g., save to backend)
    console.log(data);
    // toast({ title: "Settings Saved", description: "Your bot settings have been updated." });
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
              Securely connect your Binance account. Ensure API keys have trading permissions but NOT withdrawal permissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
              <AlertCircle className="h-5 w-5 text-primary" />
              <AlertTitle className="text-primary font-semibold">Important Security Notice</AlertTitle>
              <AlertDescription>
                Never share your API Secret Key. For maximum security, create API keys with restricted access: enable Spot & Margin Trading only. DO NOT enable withdrawals.
              </AlertDescription>
            </Alert>
            <FormField
              control={form.control}
              name="binanceApiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Binance API Key</FormLabel>
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
                  <FormLabel>Binance Secret Key</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Enter your Binance Secret Key" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
          <Zap className="mr-2 h-5 w-5" /> Save Settings
        </Button>
      </form>
    </Form>
  );
}
