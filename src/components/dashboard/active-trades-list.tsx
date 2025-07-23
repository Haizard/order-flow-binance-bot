

import { Bitcoin, TrendingUp, TrendingDown, Hourglass, AlertTriangle, Activity, Info, AlertCircle, BarChartBig } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { get24hrTicker } from '@/services/binance';
import * as tradeService from '@/services/tradeService';
import type { Ticker24hr } from '@/types/binance';
import type { Trade } from '@/types/trade';
import { cn } from '@/lib/utils';
import { getSession } from '@/lib/session';

interface ProcessedTrade extends Trade {
  currentPrice: number | null;
  pnl: number | null;
  pnlPercentage: number | null;
  fetchError: boolean;
}

interface ActiveTradesListProps {
  userId: string;
}

async function fetchAndProcessActiveBotTrades(userId: string): Promise<ProcessedTrade[]> {
  const botTrades = await tradeService.getActiveTrades(userId);
  const processedTrades: ProcessedTrade[] = [];

  for (const trade of botTrades) {
    try {
      const tickerResult = await get24hrTicker(trade.symbol);
      const tickerData = Array.isArray(tickerResult) ? tickerResult.find(t => t.symbol === trade.symbol) || null : tickerResult;

      if (tickerData) {
        const currentPrice = parseFloat(tickerData.lastPrice);
        if (isNaN(currentPrice)) {
            console.warn(`[${new Date().toISOString()}] ActiveTradesList (user ${userId}): Parsed currentPrice is NaN for ${trade.symbol}. Ticker lastPrice: ${tickerData.lastPrice}`);
            processedTrades.push({ ...trade, currentPrice: null, pnl: null, pnlPercentage: null, fetchError: true });
        } else {
            let pnlValue;
            if (trade.tradeDirection === 'SHORT') {
                pnlValue = (trade.entryPrice - currentPrice) * trade.quantity;
            } else { // LONG
                pnlValue = (currentPrice - trade.entryPrice) * trade.quantity;
            }
            const pnlPercentageValue = (trade.entryPrice * trade.quantity === 0) ? 0 : (pnlValue / (trade.entryPrice * trade.quantity)) * 100;
            
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
  // If userId is a dummy, don't fetch trades. This is for the subscription gate layout.
  if (userId === "DUMMY_FOR_LAYOUT") {
    return <Card className="shadow-card"><CardContent className="h-64"></CardContent></Card>;
  }

  const activeBotTrades = await fetchAndProcessActiveBotTrades(userId);

  if (activeBotTrades.length === 0) {
    return (
      <Card className="shadow-card">
        <CardHeader className="pb-4 pt-5 px-5">
          <CardTitle className="text-xl font-headline flex items-center">
            <Activity className="mr-2.5 h-5 w-5 text-primary" />
            Active Bot Trades
          </CardTitle>
          <CardDescription className="text-sm">No active bot-managed trades for this user.</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg bg-muted/30">
            <Hourglass className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Your bot's active trades will appear here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasAnyFetchError = activeBotTrades.some(at => at.fetchError);


  return (
    <Card className="shadow-card">
      <CardHeader className="pb-4 pt-5 px-5">
        <CardTitle className="text-xl font-headline flex items-center">
            <Activity className="mr-2.5 h-5 w-5 text-primary" />
            Active Bot Trades
        </CardTitle>
        <CardDescription className="space-y-1 text-sm">
          <span className="flex items-center text-muted-foreground">
            <Info className="h-4 w-4 mr-1.5 flex-shrink-0" />
            Bot-managed open positions. P&L calculated with live prices. Auto-refreshes.
          </span>
          {hasAnyFetchError && (
            <span className="text-destructive-foreground/80 text-xs block flex items-center bg-destructive/10 p-1.5 rounded-md mt-1.5">
              <AlertTriangle className="h-4 w-4 mr-1.5 text-destructive flex-shrink-0" />
              Live P&L data for some trades might be unavailable (showing "N/A").
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-5 pb-5">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold bg-muted/50 h-11 px-3">Symbol</TableHead>
                <TableHead className="text-right font-semibold bg-muted/50 h-11 px-3">Entry Price</TableHead>
                <TableHead className="text-right font-semibold bg-muted/50 h-11 px-3">Current Price</TableHead>
                <TableHead className="text-right font-semibold bg-muted/50 h-11 px-3">P&amp;L ({activeBotTrades.find(t=>t.quoteAsset)?.quoteAsset || 'USD'})</TableHead>
                <TableHead className="font-semibold bg-muted/50 h-11 px-3">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeBotTrades.map((trade) => (
                <TableRow key={trade.id} className="hover:bg-muted/30">
                  <TableCell className="p-3">
                    <div className="flex items-center gap-2">
                       {trade.tradeDirection === 'LONG' ? <TrendingUp className="h-5 w-5 text-accent" /> : <TrendingDown className="h-5 w-5 text-destructive" />}
                      <span className="font-medium">{trade.baseAsset}/{trade.quoteAsset}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right p-3">${trade.entryPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: trade.entryPrice < 1 ? 8 : 4})}</TableCell>
                  <TableCell className="text-right p-3">
                    {trade.currentPrice !== null ? 
                      `$${trade.currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: trade.currentPrice < 1 ? 8 : 4})}` : 
                      <span className="text-muted-foreground">N/A</span>
                    }
                  </TableCell>
                  {trade.pnl !== null && trade.pnlPercentage !== null && !trade.fetchError ? (
                    <TableCell className={cn("text-right p-3 font-medium", trade.pnl >= 0 ? 'text-accent' : 'text-destructive')}>
                      ${trade.pnl.toFixed(2)} ({trade.pnlPercentage.toFixed(2)}%)
                      {trade.pnl >= 0 ? <TrendingUp className="inline ml-1 h-4 w-4" /> : <TrendingDown className="inline ml-1 h-4 w-4" />}
                    </TableCell>
                  ) : (
                    <TableCell className="text-right p-3 text-muted-foreground">
                      N/A 
                      <AlertCircle className="inline ml-1 h-4 w-4 text-orange-400" titleAccess="Live price data unavailable"/>
                    </TableCell>
                  )}
                  <TableCell className="p-3">
                    <Badge variant={trade.status.includes('TRAILING') ? 'default' : 'secondary'}>
                      {trade.status.replace('ACTIVE_', '').replace('_', ' ')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
