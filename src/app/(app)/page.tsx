
import { DollarSign, ListChecks, Bot, TrendingUp, SearchX, TrendingDown, Activity, AlertTriangle, Info } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/metric-card';
import { ActiveTradesList } from '@/components/dashboard/active-trades-list';
import { MarketOverviewItem } from '@/components/dashboard/market-overview-item';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from 'next/image';
import { get24hrTicker } from '@/services/binance';
import type { Ticker24hr } from '@/types/binance';
import { defaultValues as defaultSettingsConfig } from '@/components/settings/settings-form';
import type { SettingsFormValues } from '@/components/settings/settings-form';
import { runBotCycle } from '@/core/bot';
import * as tradeService from '@/services/tradeService';
import type { Trade } from '@/types/trade';

export const dynamic = 'force-dynamic'; // Ensure the page is always dynamically rendered

async function getMarketData(symbols: string[]): Promise<Ticker24hr[]> {
  console.log(`[${new Date().toISOString()}] DashboardPage: getMarketData called for symbols:`, symbols);
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

async function calculateTotalPnlFromBotTrades(): Promise<number> {
  console.log(`[${new Date().toISOString()}] DashboardPage: calculateTotalPnlFromBotTrades called`);
  let totalPnl = 0;
  const activeTradesFromDb = await tradeService.getActiveTrades();

  for (const trade of activeTradesFromDb) {
    try {
      const tickerData = await get24hrTicker(trade.symbol) as Ticker24hr | null;
      if (tickerData && !Array.isArray(tickerData)) {
        const currentPrice = parseFloat(tickerData.lastPrice);
        totalPnl += (currentPrice - trade.buyPrice) * trade.quantity;
        console.log(`[${new Date().toISOString()}] DashboardPage: Calculated P&L for bot trade ${trade.symbol}, current price: ${currentPrice}`);
      } else {
        console.warn(`[${new Date().toISOString()}] DashboardPage: No ticker data for P&L calculation (bot trade ${trade.symbol})`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] DashboardPage: Failed to fetch ticker for P&L calculation (bot trade ${trade.symbol}):`, error instanceof Error ? error.message : String(error));
    }
  }
  console.log(`[${new Date().toISOString()}] DashboardPage: Total P&L from bot trades calculated: ${totalPnl}`);
  return totalPnl;
}


export default async function DashboardPage() {
  console.log(`[${new Date().toISOString()}] DashboardPage: Component rendering started.`);

  const marketSymbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "XRPUSDT", "SOLUSDT"]; // Added SOLUSDT for more variety
  const marketData = await getMarketData(marketSymbols);

  // Use default settings and ensure bot is active for this cycle run
  const botSettingsForCycle: SettingsFormValues = {
    ...defaultSettingsConfig,
    buyAmountUsd: defaultSettingsConfig.buyAmountUsd || 100,
    dipPercentage: defaultSettingsConfig.dipPercentage || -4,
    trailActivationProfit: defaultSettingsConfig.trailActivationProfit || 3,
    trailDelta: defaultSettingsConfig.trailDelta || 1,
    isBotActive: true, // Force bot to be active for demonstration of runBotCycle
    binanceApiKey: defaultSettingsConfig.binanceApiKey || "",
    binanceSecretKey: defaultSettingsConfig.binanceSecretKey || "",
  };

  // Run the bot cycle - this will potentially create/update trades in the DB
  try {
    await runBotCycle(botSettingsForCycle, marketData);
  } catch (botError) {
    console.error(`[${new Date().toISOString()}] DashboardPage: Error running bot cycle:`, botError);
  }
  
  const totalPnl = await calculateTotalPnlFromBotTrades();
  const activeTrades = await tradeService.getActiveTrades();
  const activeTradesCount = activeTrades.length;
  
  // Bot status from settings (the actual setting, not forced one)
  const botStatus = defaultSettingsConfig.isBotActive ? "Active" : "Inactive";


  // Use dipPercentage from bot settings for display
  const dipPercentageToUse = botSettingsForCycle.dipPercentage;
  
  const potentialDipBuys = marketData.filter(
    (ticker) => parseFloat(ticker.priceChangePercent) <= dipPercentageToUse &&
                 !activeTrades.some(at => at.symbol === ticker.symbol) // Only show if not already an active trade
  );

  console.log(`[${new Date().toISOString()}] DashboardPage: Data fetching and bot cycle complete. Rendering UI. Dip threshold: ${dipPercentageToUse}%`);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline mb-6">Bot Performance</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title="Total P&L (Bot)"
            value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={DollarSign}
            description="P&L from bot-managed trades, live prices. Auto-refreshes."
            className={`shadow-md ${totalPnl >=0 ? 'text-accent-foreground' : 'text-destructive'}`}
          />
          <MetricCard
            title="Active Bot Trades"
            value={activeTradesCount.toString()}
            icon={ListChecks}
            description="Number of bot's open positions. Prices and P&L are live. Auto-refreshes."
            className="shadow-md"
          />
          <MetricCard
            title="Bot Status (Setting)"
            value={botStatus}
            icon={Bot}
            description="Bot's configured status from settings (not necessarily current cycle)."
            className={`shadow-md ${botStatus === "Active" ? "text-accent-foreground" : "text-destructive"}`}
          />
        </div>
      </div>

      <div>
        <CardHeader className="px-0 pt-0 pb-4">
          <CardTitle className="text-2xl font-semibold tracking-tight font-headline">Market Overview</CardTitle>
          <CardDescription className="flex items-center text-xs text-muted-foreground">
            <Info className="h-3 w-3 mr-1.5" /> Live market data. Auto-refreshes periodically. Some symbols may be unavailable on Testnet.
          </CardDescription>
        </CardHeader>
        {marketData.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {marketData.map(ticker => (
              <MarketOverviewItem key={ticker.symbol} ticker={ticker} />
            ))}
          </div>
        ) : (
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-muted-foreground">Could not load live market data for some symbols.</p>
                <p className="text-xs text-muted-foreground mt-1">Please check your connection or symbol list. Some symbols might be unavailable.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div>
         <CardHeader className="px-0 pt-0 pb-4">
            <CardTitle className="text-2xl font-semibold tracking-tight font-headline flex items-center">
                 <TrendingDown className="mr-2 h-6 w-6 text-primary" />
                 Potential Dip Buys (24hr ≤ {dipPercentageToUse}%)
            </CardTitle>
            <CardDescription className="flex items-center text-xs text-muted-foreground">
                <Info className="h-3 w-3 mr-1.5" /> Based on live market data & bot settings. Auto-refreshes periodically. Excludes already active bot trades.
            </CardDescription>
        </CardHeader>
        {marketData.length > 0 ? ( potentialDipBuys.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {potentialDipBuys.map(ticker => (
              <MarketOverviewItem key={`${ticker.symbol}-dip`} ticker={ticker} />
            ))}
          </div>
        ) : (
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No new coins from the monitored list meet the dip criteria (≤ {dipPercentageToUse}%) based on current bot settings and active trades.</p>
                <p className="text-xs text-muted-foreground mt-1">Market conditions may change or adjust dip settings.</p>
              </div>
            </CardContent>
          </Card>
        )
        ) : (
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">Market data unavailable to determine dips.</p>
            </CardContent>
          </Card>
        )}
      </div>
      

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActiveTradesList />
        </div>
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Bot Performance Chart
            </CardTitle>
            <CardDescription>Visual representation of your bot's trading performance.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-[16/9] w-full bg-muted rounded-md flex items-center justify-center">
              <Image 
                src="https://placehold.co/600x338.png" 
                alt="Performance Chart Placeholder" 
                width={600} 
                height={338}
                className="rounded-md object-cover"
                data-ai-hint="chart graph"
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2 text-center">Live bot performance chart coming soon.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
