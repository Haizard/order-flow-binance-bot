
import { DollarSign, ListChecks, Percent, TrendingDown, SearchX, AlertTriangle, Info, Activity } from 'lucide-react';
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
import { runBotCycle } from '@/core/bot';
import { MONITORED_MARKET_SYMBOLS } from '@/config/bot-strategy';
import * as tradeService from '@/services/tradeService';
import { defaultSettingsValues } from '@/config/settings-defaults';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEMO_USER_ID = "user123";

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


export default async function DashboardPage() {
  console.log(`[${new Date().toISOString()}] DashboardPage: Component rendering started for user ${DEMO_USER_ID}.`);

  let userSettings: SettingsFormValues;
  try {
    userSettings = await getSettings(DEMO_USER_ID);
    console.log(`[${new Date().toISOString()}] DashboardPage: Successfully loaded user settings for ${DEMO_USER_ID}. API Key Present: ${!!userSettings.binanceApiKey}, Dip Percentage: ${userSettings.dipPercentage}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] DashboardPage: Failed to load user settings for ${DEMO_USER_ID}, using defaults for bot cycle and display:`, error);
    userSettings = { ...defaultSettingsValues, userId: DEMO_USER_ID };
  }
  
  const liveMarketData = await getMarketData(MONITORED_MARKET_SYMBOLS);

  const userApiSettingsForBot = {
      binanceApiKey: userSettings.binanceApiKey,
      binanceSecretKey: userSettings.binanceSecretKey,
  };

  console.log(`[${new Date().toISOString()}] DashboardPage (user ${DEMO_USER_ID}): API keys being passed to runBotCycle: API Key Present: ${!!userApiSettingsForBot.binanceApiKey}, Secret Key Present: ${!!userApiSettingsForBot.binanceSecretKey}`);
  try {
    await runBotCycle(DEMO_USER_ID, userApiSettingsForBot, liveMarketData);
  } catch (botError) {
    console.error(`[${new Date().toISOString()}] DashboardPage: Error running bot cycle for user ${DEMO_USER_ID}:`, botError);
  }

  const totalPnl = await calculateTotalPnlFromBotTrades(DEMO_USER_ID);
  const activeTrades = await tradeService.getActiveTrades(DEMO_USER_ID);
  const activeTradesCount = activeTrades.length;
  const overallPerformancePercent = await calculateOverallPerformance(DEMO_USER_ID);

  const dipPercentageToUse = typeof userSettings.dipPercentage === 'number' 
    ? userSettings.dipPercentage 
    : defaultSettingsValues.dipPercentage;

  const potentialDipBuys = liveMarketData.filter(
    (ticker) => parseFloat(ticker.priceChangePercent) <= dipPercentageToUse &&
                 !activeTrades.some(at => at.symbol === ticker.symbol)
  );

  console.log(`[${new Date().toISOString()}] DashboardPage PRE-RENDER: User: ${DEMO_USER_ID}, Total P&L: ${totalPnl}, Active Trades: ${activeTradesCount}, Overall Win Rate: ${overallPerformancePercent}%, User Dip Setting: ${dipPercentageToUse}%, Potential Dips: ${potentialDipBuys.length}`);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="text-3xl font-headline mb-6">Bot Performance</h1>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title="Total P&L (Bot)"
            value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={DollarSign}
            description="P&L from bot-managed trades. Live prices. Auto-refreshes."
            className={`shadow-card hover:shadow-card-hover ${totalPnl >= 0 ? 'text-accent-foreground bg-accent/10 dark:bg-accent/20' : 'text-destructive bg-destructive/10 dark:bg-destructive/20'}`}
          />
          <MetricCard
            title="Active Bot Trades"
            value={activeTradesCount.toString()}
            icon={ListChecks}
            description="Open positions managed by the bot. Prices/P&L are live. Auto-refreshes."
            className="shadow-card hover:shadow-card-hover"
          />
          <MetricCard
            title="Overall Win Rate"
            value={`${overallPerformancePercent}%`}
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
            <Info className="h-4 w-4 mr-1.5 flex-shrink-0" /> Live market data. Auto-refreshes. Some symbols may be unavailable on Testnet.
          </CardDescription>
        </CardHeader>
        {liveMarketData.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {liveMarketData.map(ticker => (
              <MarketOverviewItem key={ticker.symbol} ticker={ticker} />
            ))}
          </div>
        ) : (
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-muted-foreground">Could not load live market data for some symbols.</p>
                <p className="text-xs text-muted-foreground mt-1">Please check your connection or symbol list. Some symbols might be unavailable.</p>
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
                    Shows symbols meeting your set dip percentage from Settings. Excludes active bot trades.
                </span>
                <span className="block text-xs pl-0 leading-relaxed">
                    Note: The bot's actual entries use advanced order flow metrics (VAH/VAL, Bar Character, Divergence) for precision, not just this percentage dip. This list offers a general market scan.
                </span>
            </CardDescription>
        </CardHeader>
        {liveMarketData.length > 0 ? ( potentialDipBuys.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {potentialDipBuys.map(ticker => (
              <MarketOverviewItem key={`${ticker.symbol}-dip`} ticker={ticker} />
            ))}
          </div>
        ) : (
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No new coins from the monitored list meet your dip criteria (≤ {dipPercentageToUse}%).</p>
                <p className="text-xs text-muted-foreground mt-1">Market conditions may change, or adjust your "Dip Percentage" in Settings.</p>
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
        )}
      </section>

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ActiveTradesList userId={DEMO_USER_ID} />
        </div>
        <div className="space-y-8">
          <AccountBalances userId={DEMO_USER_ID} />
          <BotPerformanceChart userId={DEMO_USER_ID} />
        </div>
      </section>
    </div>
  );
}
