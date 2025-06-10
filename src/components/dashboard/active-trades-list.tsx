
import { Bitcoin, TrendingUp, TrendingDown, Hourglass, AlertTriangle, Activity, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { get24hrTicker } from '@/services/binance';
import type { Ticker24hr } from '@/types/binance';

interface PlaceholderTrade {
  id: string;
  symbol: string; 
  baseAsset: string; 
  quoteAsset: string; 
  buyPrice: number;
  quantity: number;
  status: 'PURCHASED' | 'TRAILING'; 
}

interface ProcessedTrade extends PlaceholderTrade {
  currentPrice: number;
  pnl: number;
  pnlPercentage: number;
}

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
      if (tickerData && !Array.isArray(tickerData)) {
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
        // Fallback if ticker data is not available or in unexpected format
        processedTrades.push({ ...trade, currentPrice: trade.buyPrice, pnl: 0, pnlPercentage: 0 });
      }
    } catch (error) {
      console.error(`Failed to fetch ticker data for ${trade.symbol} in ActiveTradesList:`, error);
      // Fallback on error
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

  const hasFetchError = placeholderTradesSetup.length > 0 && activeTrades.some(at => 
    at.pnl === 0 && at.currentPrice === at.buyPrice && 
    placeholderTradesSetup.find(pt => pt.id === at.id && (pt.buyPrice !== 0 || pt.quantity !==0))
  );


  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Trades</CardTitle>
        <CardDescription className="space-y-1">
          <span className="flex items-center text-xs text-muted-foreground">
            <Info className="h-3 w-3 mr-1.5 flex-shrink-0" />
            Overview of placeholder open positions. P&L is calculated using live market prices. Auto-refreshes.
          </span>
          {hasFetchError && (
            <span className="text-destructive-foreground/80 text-xs block flex items-center">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Some P&L data might be outdated or using fallback values due to fetching issues.
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
              <TableHead className="text-right">P&amp;L ({activeTrades[0]?.quoteAsset || 'USD'})</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeTrades.map((trade) => (
              <TableRow key={trade.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {trade.baseAsset === 'BTC' ? <Bitcoin className="h-5 w-5 text-primary" /> : 
                     trade.baseAsset === 'ETH' ? <svg className="h-5 w-5 text-primary" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M15.922 2l-.39 1.12L9.95 17.502l5.972 3.63L21.902 17.5l-5.59-14.38zm.078 21.807l-5.938-3.598 5.938 8.753 5.945-8.753zM22.36 16.97L16 20.178l-6.36-3.208 6.36-6.09z"/></svg> : 
                     trade.baseAsset === 'SOL' ? <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M4.75 2.75a.75.75 0 0 0-.75.75v12.04a.75.75 0 0 0 .75.75h14.5a.75.75 0 0 0 .75-.75V7.543a.75.75 0 0 0-.75-.75H9.295a.75.75 0 0 1-.53-.22L7.046 4.854a.75.75 0 0 0-.53-.22H4.75zm4.545 4.545h10.205V15.H9.295V7.295zM2.75 18.54v-1.75h18.5v1.75a.75.75 0 0 1-.75.75H3.5a.75.75 0 0 1-.75-.75z"/></svg> :
                     <Activity className="h-5 w-5 text-primary" />}
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
