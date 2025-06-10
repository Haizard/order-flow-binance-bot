
import { DollarSign, ListChecks, Bot, TrendingUp, SearchX, TrendingDown, Activity, AlertTriangle } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/metric-card';
import { ActiveTradesList } from '@/components/dashboard/active-trades-list';
import { MarketOverviewItem } from '@/components/dashboard/market-overview-item';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from 'next/image';
import { get24hrTicker } from '@/services/binance';
import type { Ticker24hr } from '@/types/binance';

async function getMarketData(symbols: string[]): Promise<Ticker24hr[]> {
  const tickerPromises = symbols.map(async (symbol) => {
    try {
      const tickerData = await get24hrTicker(symbol.toUpperCase());
      // get24hrTicker with a symbol is expected to return a single Ticker24hr object
      if (Array.isArray(tickerData)) {
        // This case should ideally not happen if a valid symbol is provided and API behaves as expected.
        console.warn(`get24hrTicker returned an array for a single symbol request: ${symbol}. This is unexpected.`);
        return null;
      }
      return tickerData as Ticker24hr;
    } catch (error) {
      // Log the error specific to this symbol, but don't let it stop Promise.all
      console.error(`Failed to fetch market data for symbol ${symbol}:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  });

  const results = await Promise.all(tickerPromises);
  // Filter out nulls for symbols that failed to fetch
  return results.filter(item => item !== null) as Ticker24hr[];
}

// Placeholder active trades structure for dashboard summary P&L calculation.
// The bot isn't creating these trades yet, but we use them to show live P&L.
const placeholderActiveTradesForSummary = [
  { symbol: 'BTCUSDT', buyPrice: 60000, quantity: 0.1, baseAsset: 'BTC', quoteAsset: 'USDT' },
  { symbol: 'ETHUSDT', buyPrice: 3000, quantity: 1, baseAsset: 'ETH', quoteAsset: 'USDT' },
  { symbol: 'SOLUSDT', buyPrice: 150, quantity: 10, baseAsset: 'SOL', quoteAsset: 'USDT' },
];

async function calculateTotalPnl(): Promise<number> {
  let totalPnl = 0;
  for (const trade of placeholderActiveTradesForSummary) {
    try {
      const tickerData = await get24hrTicker(trade.symbol) as Ticker24hr | null;
      if (tickerData && !Array.isArray(tickerData)) {
        const currentPrice = parseFloat(tickerData.lastPrice);
        totalPnl += (currentPrice - trade.buyPrice) * trade.quantity;
      }
    } catch (error) {
      console.error(`Failed to fetch ticker for P&L calculation (${trade.symbol}):`, error);
      // If a ticker fails, P&L for that trade is not added, effectively 0 for this calculation run
    }
  }
  return totalPnl;
}


export default async function DashboardPage() {
  const totalPnl = await calculateTotalPnl();
  const activeTradesCount = placeholderActiveTradesForSummary.length;
  const botStatus = "Active"; // Placeholder, ideally from settings or bot state

  // Reduced list of symbols more likely to be available on Testnet
  const marketSymbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "XRPUSDT", "LTCUSDT"];
  const marketData = await getMarketData(marketSymbols);

  const dipPercentageThreshold = -4.0; // Placeholder, ideally from settings
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
            value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={DollarSign}
            description="Overall P&L from active trades (prices are live)"
            className={`shadow-md ${totalPnl >=0 ? 'text-accent-foreground' : 'text-destructive'}`}
          />
          <MetricCard
            title="Active Trades"
            value={activeTradesCount.toString()}
            icon={ListChecks}
            description="Bot's open positions (prices are live)"
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"> {/* Adjusted xl:grid-cols-5 to 3 for fewer items */}
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
        <h2 className="text-2xl font-semibold tracking-tight font-headline mb-4 flex items-center">
          <TrendingDown className="mr-2 h-6 w-6 text-primary" />
          Potential Dip Buys (24hr ≤ {dipPercentageThreshold}%)
        </h2>
        {marketData.length > 0 ? ( potentialDipBuys.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"> {/* Adjusted xl:grid-cols-5 to 3 */}
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
