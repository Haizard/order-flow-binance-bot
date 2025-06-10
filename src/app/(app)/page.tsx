
import { DollarSign, ListChecks, Bot, TrendingUp, SearchX, TrendingDown, Activity } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/metric-card';
import { ActiveTradesList } from '@/components/dashboard/active-trades-list';
import { MarketOverviewItem } from '@/components/dashboard/market-overview-item';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from 'next/image';
import { get24hrTicker } from '@/services/binance';
import type { Ticker24hr } from '@/types/binance';

async function getMarketData(symbols: string[]): Promise<Ticker24hr[]> {
  try {
    const data = await Promise.all(
      symbols.map(symbol => get24hrTicker(symbol) as Promise<Ticker24hr>)
    );
    return data.filter(item => item !== null) as Ticker24hr[];
  } catch (error) {
    console.error("Failed to fetch market data for dashboard:", error);
    return []; // Return empty array on error to prevent page crash
  }
}

export default async function DashboardPage() {
  // Placeholder data for bot metrics
  const totalPnl = 1250.75;
  const activeTradesCount = 3;
  const botStatus = "Active";

  const marketSymbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "ADAUSDT", "BNBUSDT"]; // Added a couple more for variety
  const marketData = await getMarketData(marketSymbols);

  // Dip detection logic
  const dipPercentageThreshold = -4.0; // Use the default from settings form for now
  const potentialDipBuys = marketData.filter(
    (ticker) => parseFloat(ticker.priceChangePercent) <= dipPercentageThreshold
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline mb-6">Bot Performance</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title="Total P&L"
            value={`$${totalPnl.toLocaleString()}`}
            icon={DollarSign}
            description="Overall profit and loss from bot"
            className="shadow-md"
          />
          <MetricCard
            title="Active Trades"
            value={activeTradesCount.toString()}
            icon={ListChecks}
            description="Bot's currently open positions"
            className="shadow-md"
          />
          <MetricCard
            title="Bot Status"
            value={botStatus}
            icon={Bot}
            description="Trading bot operational status"
            className={`shadow-md ${botStatus === "Active" ? "text-accent-foreground" : "text-destructive"}`}
          />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight font-headline mb-4">Market Overview</h2>
        {marketData.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {marketData.map(ticker => (
              <MarketOverviewItem key={ticker.symbol} ticker={ticker} />
            ))}
          </div>
        ) : (
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">Could not load market data. Please try again later.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight font-headline mb-4 flex items-center">
          <TrendingDown className="mr-2 h-6 w-6 text-primary" />
          Potential Dip Buys (≤ {dipPercentageThreshold}%)
        </h2>
        {potentialDipBuys.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {potentialDipBuys.map(ticker => (
              <MarketOverviewItem key={`${ticker.symbol}-dip`} ticker={ticker} />
            ))}
          </div>
        ) : (
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No coins from the monitored list meet the dip criteria (≤ {dipPercentageThreshold}% in 24hr).</p>
                <p className="text-xs text-muted-foreground mt-1">Adjust settings or market conditions may change.</p>
              </div>
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
            <p className="text-sm text-muted-foreground mt-2 text-center">Bot performance chart coming soon.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
