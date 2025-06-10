
import { Bitcoin, TrendingUp, TrendingDown, Hourglass, AlertTriangle, Activity, Info, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { get24hrTicker } from '@/services/binance';
import * as tradeService from '@/services/tradeService';
import type { Ticker24hr } from '@/types/binance';
import type { Trade } from '@/types/trade';

interface ProcessedTrade extends Trade {
  currentPrice: number | null;
  pnl: number | null;
  pnlPercentage: number | null;
  fetchError: boolean;
}

interface ActiveTradesListProps {
  userId: string; // Expect userId to be passed as a prop
}

async function fetchAndProcessActiveBotTrades(userId: string): Promise<ProcessedTrade[]> {
  const botTrades = await tradeService.getActiveTrades(userId); // Use userId
  const processedTrades: ProcessedTrade[] = [];

  for (const trade of botTrades) {
    try {
      const tickerResult = await get24hrTicker(trade.symbol);
      const tickerData = Array.isArray(tickerResult) ? tickerResult.find(t => t.symbol === trade.symbol) || null : tickerResult;

      if (tickerData) {
        const currentPrice = parseFloat(tickerData.lastPrice);
        if (isNaN(currentPrice)) { // Additional check for NaN after parseFloat
            console.warn(`[${new Date().toISOString()}] ActiveTradesList (user ${userId}): Parsed currentPrice is NaN for ${trade.symbol}. Ticker lastPrice: ${tickerData.lastPrice}`);
            processedTrades.push({ ...trade, currentPrice: null, pnl: null, pnlPercentage: null, fetchError: true });
        } else {
            const pnlValue = (currentPrice - trade.buyPrice) * trade.quantity;
            const pnlPercentageValue = (trade.buyPrice * trade.quantity === 0) ? 0 : (pnlValue / (trade.buyPrice * trade.quantity)) * 100;
            processedTrades.push({
              ...trade,
              currentPrice,
              pnl: pnlValue,
              pnlPercentage: pnlPercentageValue,
              fetchError: false,
            });
        }
      } else {
        console.warn(`[${new Date().toISOString()}] ActiveTradesList (user ${userId}): No ticker data found for active trade ${trade.symbol}.`);
        processedTrades.push({ ...trade, currentPrice: null, pnl: null, pnlPercentage: null, fetchError: true });
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Failed to fetch ticker data for ${trade.symbol} (user ${userId}) in ActiveTradesList:`, error);
      processedTrades.push({ ...trade, currentPrice: null, pnl: null, pnlPercentage: null, fetchError: true });
    }
  }
  
  if(processedTrades.some(pt => pt.fetchError)){
      console.warn(`[${new Date().toISOString()}] ActiveTradesList (user ${userId}): One or more trades had issues fetching live prices. Fallback data used (null P&L).`);
  }
  return processedTrades;
}


export async function ActiveTradesList({ userId }: ActiveTradesListProps) {
  const activeBotTrades = await fetchAndProcessActiveBotTrades(userId);

  if (activeBotTrades.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Bot Trades</CardTitle>
          <CardDescription>No active bot-managed trades for this user at the moment.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Hourglass className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Your bot's active trades will appear here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasAnyFetchError = activeBotTrades.some(at => at.fetchError);


  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Bot Trades</CardTitle>
        <CardDescription className="space-y-1">
          <span className="flex items-center text-xs text-muted-foreground">
            <Info className="h-3 w-3 mr-1.5 flex-shrink-0" />
            Bot-managed open positions. P&L calculated with live prices. Auto-refreshes.
          </span>
          {hasAnyFetchError && (
            <span className="text-destructive-foreground/80 text-xs block flex items-center bg-destructive/10 p-1 rounded-sm">
              <AlertTriangle className="h-3 w-3 mr-1 text-destructive" />
              Live P&L data for some trades might be unavailable due to fetching issues (showing "N/A").
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
              <TableHead className="text-right">P&amp;L ({activeBotTrades.find(t=>t.quoteAsset)?.quoteAsset || 'USD'})</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeBotTrades.map((trade) => (
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
                <TableCell className="text-right">${trade.buyPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: trade.buyPrice < 1 ? 8 : 4})}</TableCell>
                <TableCell className="text-right">
                  {trade.currentPrice !== null ? 
                    `$${trade.currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: trade.currentPrice < 1 ? 8 : 4})}` : 
                    <span className="text-muted-foreground">N/A</span>
                  }
                </TableCell>
                {trade.pnl !== null && trade.pnlPercentage !== null && !trade.fetchError ? (
                  <TableCell className={`text-right font-medium ${trade.pnl >= 0 ? 'text-accent-foreground' : 'text-destructive'}`}>
                    ${trade.pnl.toFixed(2)} ({trade.pnlPercentage.toFixed(2)}%)
                    {trade.pnl >= 0 ? <TrendingUp className="inline ml-1 h-4 w-4" /> : <TrendingDown className="inline ml-1 h-4 w-4" />}
                  </TableCell>
                ) : (
                  <TableCell className="text-right text-muted-foreground">
                    N/A 
                    <AlertCircle className="inline ml-1 h-4 w-4 text-orange-400" titleAccess="Live price data unavailable"/>
                  </TableCell>
                )}
                <TableCell>
                  <Badge variant={trade.status === 'ACTIVE_TRAILING' ? 'default' : (trade.status === 'ACTIVE_BOUGHT' ? 'secondary' : 'outline')}>
                    {trade.status.replace('ACTIVE_', '')}
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
