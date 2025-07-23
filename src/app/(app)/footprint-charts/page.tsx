
// src/app/(app)/footprint-charts/page.tsx
import { getSettings } from "@/services/settingsService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Lock } from "lucide-react";
import Link from "next/link";
import FootprintChartsClient from "@/components/footprint/footprint-charts-client";
import { defaultSettingsValues } from "@/config/settings-defaults";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function FootprintChartsPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const settings = await getSettings(session.id);

  if (!settings.hasActiveSubscription) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <Card className="w-full max-w-md shadow-lg text-center">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 font-headline text-primary">
              <Lock className="h-6 w-6" />
              Subscription Required
            </CardTitle>
            <CardDescription>
              Access to real-time Footprint Charts is a premium feature.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Please upgrade your plan to unlock this and other advanced trading tools.
            </p>
            <Button asChild className="w-full">
              <Link href="/subscription">
                <CreditCard className="mr-2 h-5 w-5" />
                View Subscription Plans
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If subscribed, render the client component with the user's monitored symbols
  const initialSymbols = settings.monitoredSymbols && settings.monitoredSymbols.length > 0 
    ? settings.monitoredSymbols 
    : defaultSettingsValues.monitoredSymbols;

  return <FootprintChartsClient initialMonitoredSymbols={initialSymbols.slice(0, 3)} />;
}
