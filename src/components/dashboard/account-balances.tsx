
"use server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Wallet, AlertCircle, Info, ListChecks } from "lucide-react";
import { getSettings } from "@/services/settingsService";
import { getAccountInformation } from "@/services/binance";
import type { Balance } from "@/types/binance";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "../ui/button";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

interface AccountBalancesProps {
  userId: string;
}

const PREFERRED_ASSETS = ['USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'DOGE', 'LINK', 'LTC'];

export async function AccountBalances({ userId }: AccountBalancesProps) {
  const logTimestamp = new Date().toISOString();
  console.log(`[${logTimestamp}] AccountBalances: Fetching settings for user ${userId}`);

  let settings;
  try {
    settings = await getSettings(userId);
  } catch (error) {
    console.error(`[${logTimestamp}] AccountBalances: Error fetching settings for user ${userId}:`, error);
    return (
      <Card className="shadow-card">
        <CardHeader className="pb-4 pt-5 px-5">
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Account Balances (Testnet)
          </CardTitle>
          <CardDescription className="text-sm">Your current asset balances on Binance Testnet.</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Settings</AlertTitle>
            <AlertDescription>Could not load settings to fetch balances. Please try again later.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!settings.binanceApiKey || !settings.binanceSecretKey) {
    console.log(`[${logTimestamp}] AccountBalances: API keys not configured for user ${userId}.`);
    return (
      <Card className="shadow-card">
        <CardHeader className="pb-4 pt-5 px-5">
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Account Balances (Testnet)
          </CardTitle>
          <CardDescription className="text-sm">Your current asset balances on Binance Testnet.</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>API Keys Required</AlertTitle>
            <AlertDescription>
              Please configure your Binance API Key and Secret Key in the{' '}
              <Button variant="link" asChild className="p-0 h-auto text-sm"><Link href="/settings">Settings</Link></Button> page to view your balances.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  console.log(`[${logTimestamp}] AccountBalances: API keys found for user ${userId}. Fetching account information...`);
  try {
    const accountInfo = await getAccountInformation(settings.binanceApiKey, settings.binanceSecretKey);
    const relevantBalances = accountInfo.balances.filter(
      (balance) => parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0
    );

    relevantBalances.sort((a, b) => {
      const aIsPreferred = PREFERRED_ASSETS.includes(a.asset);
      const bIsPreferred = PREFERRED_ASSETS.includes(b.asset);
      if (aIsPreferred && !bIsPreferred) return -1;
      if (!aIsPreferred && bIsPreferred) return 1;
      if (aIsPreferred && bIsPreferred) {
        return PREFERRED_ASSETS.indexOf(a.asset) - PREFERRED_ASSETS.indexOf(b.asset);
      }
      return a.asset.localeCompare(b.asset);
    });
    
    const limitedBalances = relevantBalances.slice(0, 8); 

    if (limitedBalances.length === 0) {
      return (
        <Card className="shadow-card">
          <CardHeader className="pb-4 pt-5 px-5">
            <CardTitle className="text-xl font-headline flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Account Balances (Testnet)
            </CardTitle>
            <CardDescription className="text-sm">Your current asset balances on Binance Testnet.</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-center text-muted-foreground py-8 border border-dashed rounded-lg bg-muted/30">
              <ListChecks className="h-10 w-10 mx-auto mb-3 text-muted-foreground/70" />
              No asset balances found, or all balances are zero.
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="shadow-card">
        <CardHeader className="pb-4 pt-5 px-5">
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Account Balances (Testnet)
          </CardTitle>
          <CardDescription className="text-sm">
            Showing top {limitedBalances.length > 0 ? limitedBalances.length : ''} non-zero balances. Full list in your Binance account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-5 pb-5">
          {limitedBalances.map((balance: Balance) => (
            <div key={balance.asset} className="flex justify-between items-center p-3 bg-muted/50 rounded-md hover:bg-muted/70 transition-colors">
              <Badge variant="secondary" className="text-sm font-semibold">{balance.asset}</Badge>
              <div className="text-right">
                <p className="text-sm font-mono font-medium">
                  {parseFloat(balance.free).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  Locked: {parseFloat(balance.locked).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                </p>
              </div>
            </div>
          ))}
           {relevantBalances.length > limitedBalances.length && (
            <p className="text-xs text-muted-foreground text-center pt-3">
              ...and {relevantBalances.length - limitedBalances.length} more asset(s) with balances.
            </p>
          )}
        </CardContent>
      </Card>
    );
  } catch (error) {
    console.error(`[${logTimestamp}] AccountBalances: Error fetching account information for user ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return (
      <Card className="shadow-card">
        <CardHeader className="pb-4 pt-5 px-5">
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Account Balances (Testnet)
          </CardTitle>
          <CardDescription className="text-sm">Your current asset balances on Binance Testnet.</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>API Error Fetching Balances</AlertTitle>
            <AlertDescription>
              Could not fetch account balances: {errorMessage}
              <br />
              Ensure API keys are correct, have "Enable Reading" permissions, and are for Testnet.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
}
