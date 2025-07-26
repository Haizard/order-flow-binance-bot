
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ShieldCheck, Zap, Loader2 } from "lucide-react";
import { handleCreateCheckoutSession } from "./actions";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SubscriptionPage() {
  const { toast } = useToast();
  const [isProLoading, setIsProLoading] = useState(false);
  const [isBasicLoading, setIsBasicLoading] = useState(false);

  const onUpgradeClick = async (plan: 'pro' | 'basic') => {
    if (plan === 'pro') {
      setIsProLoading(true);
    } else {
      setIsBasicLoading(true);
    }

    const result = await handleCreateCheckoutSession();

    if (result.success && result.url) {
      // Redirect to Stripe's checkout page
      window.location.href = result.url;
    } else {
      toast({
        title: "Error",
        description: result.message || "Could not create a payment session. Please try again.",
        variant: "destructive",
      });
      setIsProLoading(false);
      setIsBasicLoading(false);
    }
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
            <Card className="border-primary border-2 shadow-xl">
              <CardHeader>
                <CardTitle className="font-headline text-primary">Pro Trader</CardTitle>
                <CardDescription>Unlock all features and priority support.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-4xl font-bold">$29.99 <span className="text-sm font-normal text-muted-foreground">/ month</span></p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Automated Trading Bot</li>
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Real-time Footprint Charts</li>
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> AI Trade Summaries</li>
                  <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Priority Support</li>
                </ul>
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => onUpgradeClick('pro')}
                  disabled={isProLoading || isBasicLoading}
                >
                  {isProLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Zap className="mr-2 h-5 w-5" />}
                  {isProLoading ? 'Redirecting...' : 'Upgrade to Pro'}
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
            <p className="text-xs mt-1">Payments are securely processed by Stripe. Your payment details are not stored on our servers.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
