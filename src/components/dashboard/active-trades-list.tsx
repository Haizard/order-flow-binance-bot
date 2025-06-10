
import { Bitcoin, TrendingUp, TrendingDown, Hourglass, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { get24hrTicker } from '@/services/binance';
import type { Ticker24hr } from '@/types/binance';

interface PlaceholderTrade {
  id: string;
  symbol: string; // e.g., BTCUSDT (Binance API format)
  baseAsset: string; // e.g., BTC
  quoteAsset: string; // e.g., USDT
  buyPrice: number;
  quantity: number;
  status: 'PURCHASED' | 'TRAILING'; // Status remains placeholder
}

interface ProcessedTrade extends PlaceholderTrade {
  currentPrice: number;
  pnl: number;
  pnlPercentage: number;
}

// Placeholder trade data - symbol format updated for direct API use
const placeholderTradesSetup: PlaceholderTrade[] = [
  { id: '1', symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', buyPrice: 60000, quantity: 0.1, status: 'TRAILING' },
  { id: '2', symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', buyPrice: 3000, quantity: 1, status: 'PURCHASED' },
  { id: '3', symbol: 'SOLUSDT', baseAsset: 'SOL', quoteAsset: 'USDT', buyPrice: 150, quantity: 10, status: 'TRAILING' },
];

async function fetchActiveTradesData(): Promise<ProcessedTrade[]> {
  const processedTrades: ProcessedTrade[] = [];
  for (const trade of placeholderTradesSetup) {
    try {
      const tickerData = await get24hrTicker(trade.symbol) as Ticker24hr | null;
      if (tickerData) {
        const currentPrice = parseFloat(tickerData.lastPrice);
        const pnl = (currentPrice - trade.buyPrice) * trade.quantity;
        const pnlPercentage = (pnl / (trade.buyPrice * trade.quantity)) * 100;
        processedTrades.push({
          ...trade,
          currentPrice,
          pnl,
          pnlPercentage,
        });
      } else {
        // Handle case where ticker data might not be found (e.g. delisted symbol)
        processedTrades.push({ ...trade, currentPrice: trade.buyPrice, pnl: 0, pnlPercentage: 0 });
      }
    } catch (error) {
      console.error(`Failed to fetch ticker data for ${trade.symbol}:`, error);
      // Add trade with zero P&L if data fetch fails
      processedTrades.push({ ...trade, currentPrice: trade.buyPrice, pnl: 0, pnlPercentage: 0 });
    }
  }
  return processedTrades;
}


export async function ActiveTradesList() {
  const activeTrades = await fetchActiveTradesData();

  if (activeTrades.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Trades</CardTitle>
          <CardDescription>No active trades at the moment.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Hourglass className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Your active trades will appear here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasFetchError = placeholderTradesSetup.some(pt => 
    !activeTrades.find(at => at.id === pt.id && at.currentPrice !== at.buyPrice && at.pnl !== 0)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Trades</CardTitle>
        <CardDescription>
          Overview of your bot's simulated open positions with live P&amp;L.
          {hasFetchError && (
            <span className="text-destructive-foreground/80 text-xs block mt-1 flex items-center">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Some P&L data might be outdated due to fetching issues.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead className="text-right">Buy Price</TableHead>
              <TableHead className="text-right">Current Price</TableHead>
              <TableHead className="text-right">P&amp;L ({placeholderTradesSetup[0]?.quoteAsset || 'USD'})</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeTrades.map((trade) => (
              <TableRow key={trade.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {/* Basic icon logic, can be expanded */}
                    {trade.baseAsset === 'BTC' ? <Bitcoin className="h-5 w-5 text-primary" /> : <TrendingUp className="h-5 w-5 text-primary" />}
                    <span className="font-medium">{trade.baseAsset}/{trade.quoteAsset}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">${trade.buyPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4})}</TableCell>
                <TableCell className="text-right">${trade.currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4})}</TableCell>
                <TableCell className={`text-right font-medium ${trade.pnl >= 0 ? 'text-accent-foreground' : 'text-destructive'}`}>
                  ${trade.pnl.toFixed(2)} ({trade.pnlPercentage.toFixed(2)}%)
                  {trade.pnl >= 0 ? <TrendingUp className="inline ml-1 h-4 w-4" /> : <TrendingDown className="inline ml-1 h-4 w-4" />}
                </TableCell>
                <TableCell>
                  <Badge variant={trade.status === 'TRAILING' ? 'default' : 'secondary'}>
                    {trade.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
