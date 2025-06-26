
import { DollarSign, ListChecks, Percent, TrendingDown, SearchX, AlertTriangle, Info, Activity, Lock, CreditCard } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/metric-card';
import { ActiveTradesList } from '@/components/dashboard/active-trades-list';
import { MarketOverviewItem } from '@/components/dashboard/market-overview-item';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BotPerformanceChart } from '@/components/dashboard/bot-performance-chart';
import { AccountBalances } from '@/components/dashboard/account-balances';
import { get24hrTicker } from '@/services/binance';
import type { Ticker24hr } from '@/types/binance';
import type { SettingsFormValues } from '@/components/settings/settings-form';
import { getSettings } from '@/services/settingsService';
import * as tradeService from '@/services/tradeService';
import { defaultSettingsValues } from '@/config/settings-defaults';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CLIENT_USER_ID = "user123";
const ADMIN_USER_ID = "admin001"; // The user who controls the strategy

async function getMarketData(symbols: string[]): Promise<Ticker24hr[]> {
  console.log(`[${new Date().toISOString()}] DashboardPage: getMarketData called for symbols:`, symbols);
  if (!symbols || symbols.length === 0) {
    console.warn(`[${new Date().toISOString()}] DashboardPage: getMarketData called with no symbols.`);
    return [];
  }
  const tickerPromises = symbols.map(async (symbol) => {
    try {
      const tickerData = await get24hrTicker(symbol.toUpperCase());
      if (Array.isArray(tickerData)) {
        console.warn(`[${new Date().toISOString()}] DashboardPage: get24hrTicker returned an array for single symbol request: ${symbol}. This is unexpected.`);
        return null;
      }
      console.log(`[${new Date().toISOString()}] DashboardPage: Successfully fetched market data for ${symbol}`);
      return tickerData as Ticker24hr;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] DashboardPage: Failed to fetch market data for symbol ${symbol}:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  });

  const results = await Promise.all(tickerPromises);
  return results.filter(item => item !== null) as Ticker24hr[];
}

async function calculateTotalPnlFromBotTrades(userId: string): Promise<number> {
  const logTimestamp = new Date().toISOString();
  console.log(`[${logTimestamp}] DashboardPage: calculateTotalPnlFromBotTrades called for user ${userId}`);
  let totalPnl = 0;
  const activeTradesFromDb = await tradeService.getActiveTrades(userId);

  for (const trade of activeTradesFromDb) {
    try {
      const tickerData = await get24hrTicker(trade.symbol) as Ticker24hr | null;
      if (tickerData && !Array.isArray(tickerData)) {
        const currentPrice = parseFloat(tickerData.lastPrice);
        if (trade.tradeDirection === 'SHORT') {
            totalPnl += (trade.entryPrice - currentPrice) * trade.quantity;
        } else { // 'LONG'
            totalPnl += (currentPrice - trade.entryPrice) * trade.quantity;
        }
      } else {
        console.warn(`[${logTimestamp}] DashboardPage: No ticker data for P&L calculation (bot trade ${trade.symbol}, user ${userId})`);
      }
    } catch (error) {
      console.error(`[${logTimestamp}] DashboardPage: Failed to fetch ticker for P&L calculation (bot trade ${trade.symbol}, user ${userId}):`, error instanceof Error ? error.message : String(error));
    }
  }
  console.log(`[${logTimestamp}] DashboardPage: Total P&L from bot trades for user ${userId} calculated: ${totalPnl}`);
  return totalPnl;
}

async function calculateOverallPerformance(userId: string): Promise<string> {
  const logTimestamp = new Date().toISOString();
  console.log(`[${logTimestamp}] DashboardPage: calculateOverallPerformance called for user ${userId}`);
  const closedTrades = await tradeService.getClosedTrades(userId);
  console.log(`[${logTimestamp}] DashboardPage: calculateOverallPerformance (user ${userId}): Total closed trades: ${closedTrades.length}`);
  
  const exitedTrades = closedTrades.filter(
    trade => trade.status === 'CLOSED_EXITED' && typeof trade.pnl === 'number'
  );
  console.log(`[${logTimestamp}] DashboardPage: calculateOverallPerformance (user ${userId}): Filtered 'CLOSED_EXITED' trades with P&L: ${exitedTrades.length}`);


  if (exitedTrades.length === 0) {
    console.log(`[${logTimestamp}] DashboardPage: No CLOSED_EXITED trades found for performance calculation for user ${userId}.`);
    return "0.0";
  }

  const profitableTrades = exitedTrades.filter(trade => trade.pnl! > 0).length;
  console.log(`[${logTimestamp}] DashboardPage: calculateOverallPerformance (user ${userId}): Profitable 'CLOSED_EXITED' trades: ${profitableTrades}`);
  
  const winRate = (profitableTrades / exitedTrades.length) * 100;
  const formattedWinRate = winRate.toFixed(1);
  console.log(`[${logTimestamp}] DashboardPage: Overall performance for user ${userId}: Calculated winRate: ${winRate}, Returning: "${formattedWinRate}" (will become "${formattedWinRate}%") (${profitableTrades}/${exitedTrades.length})`);
  return formattedWinRate;
}

function SubscriptionGate({ featureName, children }: { featureName: string, children: React.ReactNode }) {
  return (
    <Card className="shadow-card relative overflow-hidden">
      <CardContent className="pt-6">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
          <Lock className="h-10 w-10 text-primary mb-4" />
          <p className="font-semibold text-lg text-center mb-2">Unlock {featureName}</p>
          <p className="text-muted-foreground text-sm text-center mb-4">This feature is available on our Pro plan.</p>
          <Button asChild>
            <Link href="/subscription">
              <CreditCard className="mr-2 h-4 w-4" />
              Upgrade Subscription
            </Link>
          </Button>
        </div>
        <div className="blur-sm pointer-events-none select-none">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}


export default async function DashboardPage() {
  console.log(`[${new Date().toISOString()}] DashboardPage: Component rendering started for user ${CLIENT_USER_ID}.`);

  let clientSettings: SettingsFormValues;
  let adminSettings: SettingsFormValues;
  try {
    clientSettings = await getSettings(CLIENT_USER_ID);
    adminSettings = await getSettings(ADMIN_USER_ID);
    console.log(`[${new Date().toISOString()}] DashboardPage: Successfully loaded settings for client ${CLIENT_USER_ID} and admin ${ADMIN_USER_ID}.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] DashboardPage: Failed to load settings, using defaults for display:`, error);
    clientSettings = { ...defaultSettingsValues, userId: CLIENT_USER_ID };
    adminSettings = { ...defaultSettingsValues, userId: ADMIN_USER_ID };
  }
  
  const isSubscribed = clientSettings.hasActiveSubscription;

  // The bot uses the admin's monitored symbols for analysis.
  const monitoredSymbolsToUse = adminSettings.monitoredSymbols && adminSettings.monitoredSymbols.length > 0
    ? adminSettings.monitoredSymbols
    : defaultSettingsValues.monitoredSymbols;

  const liveMarketData = await getMarketData(monitoredSymbolsToUse);
  
  const totalPnl = await calculateTotalPnlFromBotTrades(CLIENT_USER_ID);
  const activeTrades = await tradeService.getActiveTrades(CLIENT_USER_ID);
  const activeTradesCount = activeTrades.length;
  const overallPerformancePercent = await calculateOverallPerformance(CLIENT_USER_ID);

  // The bot uses the admin's dip percentage for its logic.
  const dipPercentageToUse = typeof adminSettings.dipPercentage === 'number' 
    ? adminSettings.dipPercentage 
    : defaultSettingsValues.dipPercentage;

  const potentialDipBuys = liveMarketData.filter(
    (ticker) => parseFloat(ticker.priceChangePercent) <= dipPercentageToUse &&
                 !activeTrades.some(at => at.symbol === ticker.symbol)
  );

  console.log(`[${new Date().toISOString()}] DashboardPage PRE-RENDER: User: ${CLIENT_USER_ID}, Subscribed: ${isSubscribed}, Total P&L: ${totalPnl}, Active Trades: ${activeTradesCount}`);

  return (
    <div className="flex flex-col gap-8">
      {!isSubscribed && (
        <Alert variant="default" className="bg-primary/10 border-primary/30 text-primary-foreground">
          <CreditCard className="h-5 w-5 text-primary" />
          <AlertTitle className="font-bold text-primary">Upgrade to Pro!</AlertTitle>
          <AlertDescription className="text-primary/90">
            Your bot is currently inactive. Please <Button variant="link" asChild className="p-0 h-auto text-sm text-primary font-bold"><Link href="/subscription">subscribe</Link></Button> to activate the trading bot and unlock all features.
          </AlertDescription>
        </Alert>
      )}

      <section>
        <h1 className="text-3xl font-headline mb-6">Bot Performance</h1>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title="Total P&L (Bot)"
            value={isSubscribed ? `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
            icon={DollarSign}
            description="P&L from bot-managed trades. Live prices. Auto-refreshes."
            className={`shadow-card hover:shadow-card-hover ${isSubscribed ? (totalPnl >= 0 ? 'text-accent-foreground bg-accent/10 dark:bg-accent/20' : 'text-destructive bg-destructive/10 dark:bg-destructive/20') : ''}`}
          />
          <MetricCard
            title="Active Bot Trades"
            value={isSubscribed ? activeTradesCount.toString() : 'N/A'}
            icon={ListChecks}
            description="Open positions managed by the bot. Auto-refreshes."
            className="shadow-card hover:shadow-card-hover"
          />
          <MetricCard
            title="Overall Win Rate"
            value={isSubscribed ? `${overallPerformancePercent}%` : 'N/A'}
            icon={Percent}
            description="Profitable closed trades. Auto-refreshes."
            className="shadow-card hover:shadow-card-hover"
          />
        </div>
      </section>

      <section>
        <CardHeader className="px-0 pt-0 pb-4">
          <CardTitle className="text-2xl font-headline flex items-center">
            <Activity className="mr-3 h-6 w-6 text-primary" />
            Market Overview
          </CardTitle>
          <CardDescription className="flex items-center text-sm text-muted-foreground">
            <Info className="h-4 w-4 mr-1.5 flex-shrink-0" /> Live market data for your monitored symbols. Auto-refreshes.
          </CardDescription>
        </CardHeader>
        {liveMarketData.length > 0 ? (
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
            {liveMarketData.map(ticker => (
              <MarketOverviewItem key={ticker.symbol} ticker={ticker} />
            ))}
          </div>
        ) : (
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-muted-foreground">Could not load live market data.</p>
                <p className="text-xs text-muted-foreground mt-1">Please check your connection or the symbols in your settings.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      <section>
         <CardHeader className="px-0 pt-0 pb-4">
            <CardTitle className="text-2xl font-headline flex items-center">
                 <TrendingDown className="mr-3 h-6 w-6 text-primary" />
                 Potential Dip Buys (24hr ≤ {dipPercentageToUse}%)
            </CardTitle>
             <CardDescription className="space-y-1 text-sm text-muted-foreground">
                <span className="flex items-center">
                    <Info className="h-4 w-4 mr-1.5 flex-shrink-0" />
                    {isSubscribed 
                      ? "Shows symbols from the admin-monitored list meeting the dip %. Excludes active bot trades." 
                      : "Subscribe to see potential trading opportunities based on the admin's settings."
                    }
                </span>
                <span className="block text-xs pl-0 leading-relaxed">
                    Note: The bot's actual entries use advanced order flow metrics for precision.
                </span>
            </CardDescription>
        </CardHeader>
        {isSubscribed ? (
          liveMarketData.length > 0 ? ( potentialDipBuys.length > 0 ? (
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
              {potentialDipBuys.map(ticker => (
                <MarketOverviewItem key={`${ticker.symbol}-dip`} ticker={ticker} />
              ))}
            </div>
          ) : (
            <Card className="shadow-card">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No new coins from the monitored list meet the admin's dip criteria (≤ {dipPercentageToUse}%).</p>
                  <p className="text-xs text-muted-foreground mt-1">Market conditions may change. The admin controls the "Dip Percentage" setting.</p>
                </div>
              </CardContent>
            </Card>
          )
          ) : (
            <Card className="shadow-card">
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">Market data unavailable to determine dips.</p>
              </CardContent>
            </Card>
          )
        ) : (
           <SubscriptionGate featureName="Potential Dip Buys">
             <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
                {/* Placeholder content for blurring */}
                {[...Array(3)].map((_, i) => <MarketOverviewItem key={i} ticker={{ symbol: 'LOCKED', lastPrice: '0', priceChangePercent: '-10.00' }} />)}
             </div>
           </SubscriptionGate>
        )}
      </section>

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="xl:col-span-2">
           {isSubscribed ? <ActiveTradesList userId={CLIENT_USER_ID} /> : (
            <SubscriptionGate featureName="Active Trades List">
               <ActiveTradesList userId="DUMMY_FOR_LAYOUT" />
            </SubscriptionGate>
           )}
        </div>
        <div className="space-y-8">
          <AccountBalances userId={CLIENT_USER_ID} />
          <BotPerformanceChart userId={CLIENT_USER_ID} />
        </div>
      </section>
    </div>
  );
}
