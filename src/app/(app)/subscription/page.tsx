
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ShieldCheck, Zap, Loader2, Bot } from "lucide-react";
import { handleCreateCheckoutSession, handleCreateBinancePayOrder } from "./actions";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Placeholder IDs - replace these with your actual Stripe Price IDs
const PRO_TRADER_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || 'price_123_pro';
const MT5_BOT_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_MT5_PRICE_ID || 'price_123_mt5';

export default function SubscriptionPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const onUpgradeWithStripe = async (priceId: string, planName: string) => {
    setIsLoading(planName);

    const result = await handleCreateCheckoutSession(priceId);

    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      toast({
        title: "Error",
        description: result.message || "Could not create a payment session. Please try again.",
        variant: "destructive",
      });
      setIsLoading(null);
    }
  };

  const onUpgradeWithBinance = async () => {
    setIsLoading('binance');

    const result = await handleCreateBinancePayOrder();

    if (result.success && result.url) {
        window.location.href = result.url;
    } else {
        toast({
            title: "Coming Soon",
            description: result.message,
            variant: "default",
        });
    }
    
    setIsLoading(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Subscription Plans</h1>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <CreditCard className="h-6 w-6 text-primary" />
            Choose a plan that fits your trading needs
          </CardTitle>
          <CardDescription>
            Both plans come with 24/7 support and access to our community.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <Card className="border-primary border-2 shadow-xl flex flex-col">
              <CardHeader>
                <CardTitle className="font-headline text-primary">Binance Trailblazer Bot</CardTitle>
                <CardDescription>Automated order flow trading on Binance.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 flex-grow">
                <p className="text-4xl font-bold">$29.99 <span className="text-sm font-normal text-muted-foreground">/ month</span></p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Automated Trading Bot for Binance</li>
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Real-time Footprint Charts</li>
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> AI Trade Summaries</li>
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Priority Support</li>
                </ul>
              </CardContent>
              <CardContent className="flex flex-col gap-3">
                 <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => onUpgradeWithStripe(PRO_TRADER_PRICE_ID, 'pro')}
                  disabled={!!isLoading}
                >
                  {isLoading === 'pro' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Zap className="mr-2 h-5 w-5" />}
                  {isLoading === 'pro' ? 'Redirecting...' : 'Pay with Card (Stripe)'}
                </Button>
                <Button 
                  variant="outline"
                  className="w-full"
                  onClick={onUpgradeWithBinance}
                  disabled={!!isLoading}
                >
                  {isLoading === 'binance' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png" alt="Binance Coin" className="mr-2 h-5 w-5" />}
                  {isLoading === 'binance' ? 'Processing...' : 'Pay with Binance'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border flex flex-col">
              <CardHeader>
                <CardTitle className="font-headline">MetaTrader 5 Bot</CardTitle>
                <CardDescription>Trade on MT5 brokers like Deriv.com.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 flex-grow">
                <p className="text-4xl font-bold">$39.99 <span className="text-sm font-normal text-muted-foreground">/ month</span></p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Bot className="h-4 w-4 text-accent" /> Connect to any MT5 Broker</li>
                  <li className="flex items-center gap-2"><Bot className="h-4 w-4 text-accent" /> Supports Deriv, Synthetics, etc.</li>
                  <li className="flex items-center gap-2"><Bot className="h-4 w-4 text-accent" /> Easy Setup File (.ex5)</li>
                  <li className="flex items-center gap-2"><Bot className="h-4 w-4 text-accent" /> 24/7 Community Support</li>
                </ul>
              </CardContent>
              <CardContent className="flex flex-col gap-3">
                 <Button 
                  className="w-full"
                  onClick={() => onUpgradeWithStripe(MT5_BOT_PRICE_ID, 'mt5')}
                  disabled={!!isLoading}
                >
                  {isLoading === 'mt5' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Zap className="mr-2 h-5 w-5" />}
                  {isLoading === 'mt5' ? 'Redirecting...' : 'Pay with Card (Stripe)'}
                </Button>
                <Button 
                  variant="outline"
                  className="w-full"
                  disabled
                >
                  Binance Pay Not Applicable
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-headline">Basic (Coming Soon)</CardTitle>
                <CardDescription>Get started with essential automated trading.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-4xl font-bold">$9.99 <span className="text-sm font-normal text-muted-foreground">/ month</span></p>
                 <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> 100 Trades / Month</li>
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Basic Analytics</li>
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Email Support</li>
                </ul>
                <Button variant="outline" className="w-full" disabled>
                  Coming Soon
                </Button>
              </CardContent>
            </Card>
          </div>
          
          <div className="text-center text-muted-foreground">
            <p className="text-xs mt-1">Card payments are securely processed by Stripe. Your payment details are not stored on our servers.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
