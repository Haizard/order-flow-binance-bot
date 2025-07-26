
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ShieldCheck, Zap, Loader2 } from "lucide-react";
import { handleCreateCheckoutSession, handleCreateBinancePayOrder } from "./actions";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SubscriptionPage() {
  const { toast } = useToast();
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  const [isBinanceLoading, setIsBinanceLoading] = useState(false);

  const onUpgradeWithStripe = async () => {
    setIsStripeLoading(true);
    setIsBinanceLoading(true); // Disable both buttons

    const result = await handleCreateCheckoutSession();

    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      toast({
        title: "Error",
        description: result.message || "Could not create a payment session. Please try again.",
        variant: "destructive",
      });
      setIsStripeLoading(false);
      setIsBinanceLoading(false);
    }
  };

  const onUpgradeWithBinance = async () => {
    setIsStripeLoading(true);
    setIsBinanceLoading(true); // Disable both buttons

    const result = await handleCreateBinancePayOrder();

    if (result.success && result.url) {
        // In a real implementation, this would redirect to Binance Pay
        window.location.href = result.url;
    } else {
        toast({
            title: "Coming Soon",
            description: result.message,
            variant: "default",
        });
    }
    
    // Always re-enable buttons after the action
    setIsStripeLoading(false);
    setIsBinanceLoading(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Subscription</h1>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <CreditCard className="h-6 w-6 text-primary" />
            Manage Your Subscription
          </CardTitle>
          <CardDescription>
            Choose a plan that fits your trading needs or manage your current subscription.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-primary border-2 shadow-xl flex flex-col">
              <CardHeader>
                <CardTitle className="font-headline text-primary">Pro Trader</CardTitle>
                <CardDescription>Unlock all features and priority support.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 flex-grow">
                <p className="text-4xl font-bold">$29.99 <span className="text-sm font-normal text-muted-foreground">/ month</span></p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Automated Trading Bot</li>
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Real-time Footprint Charts</li>
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> AI Trade Summaries</li>
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Priority Support</li>
                </ul>
              </CardContent>
              <CardContent className="flex flex-col gap-3">
                 <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => onUpgradeWithStripe()}
                  disabled={isStripeLoading || isBinanceLoading}
                >
                  {isStripeLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Zap className="mr-2 h-5 w-5" />}
                  {isStripeLoading ? 'Redirecting...' : 'Pay with Card (Stripe)'}
                </Button>
                <Button 
                  variant="outline"
                  className="w-full"
                  onClick={() => onUpgradeWithBinance()}
                  disabled={isStripeLoading || isBinanceLoading}
                >
                  {isBinanceLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png" alt="Binance Coin" className="mr-2 h-5 w-5" />}
                  {isBinanceLoading ? 'Processing...' : 'Pay with Binance'}
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
