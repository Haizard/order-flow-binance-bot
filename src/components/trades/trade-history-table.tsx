
"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bitcoin, TrendingUp, TrendingDown, ArrowLeft, ArrowRight, History, AlertTriangle, ServerCrash, Activity, BarChartBig } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import * as tradeService from '@/services/tradeService';
import type { Trade } from '@/types/trade';
import { cn } from "@/lib/utils";

const TRADES_PER_PAGE = 10;

function formatCurrency(value: number | undefined, quoteAsset: string = 'USD') {
  if (value === undefined || value === null) return 'N/A';
  const maximumFractionDigits = (quoteAsset === 'USDT' && Math.abs(value) < 1 && value !== 0) ? 8 : 2;
  return `${value >= 0 ? '' : '-'}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits })}`;
}

interface TradeHistoryTableProps {
  userId: string;
}

export function TradeHistoryTable({ userId }: TradeHistoryTableProps) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [closedTrades, setClosedTrades] = React.useState<Trade[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchClosedTrades() {
      if (!userId) {
        console.warn("TradeHistoryTable: userId is missing, cannot fetch trades.");
        setIsLoading(false);
        setError("User ID is missing.");
        return;
      }
      console.log(`[${new Date().toISOString()}] TradeHistoryTable: Fetching closed trades for user: ${userId}`);
      setIsLoading(true);
      setError(null);
      try {
        const trades = await tradeService.getClosedTrades(userId);
        console.log(`[${new Date().toISOString()}] TradeHistoryTable: Fetched ${trades.length} closed trades for user ${userId}.`);
        setClosedTrades(trades.sort((a, b) => (b.sellTimestamp || 0) - (a.sellTimestamp || 0)));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred while fetching trade history.";
        console.error(`[${new Date().toISOString()}] TradeHistoryTable: Failed to fetch closed trades for user ${userId}:`, errorMessage);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
    fetchClosedTrades();
  }, [userId]);

  const totalPages = Math.ceil(closedTrades.length / TRADES_PER_PAGE);
  const startIndex = (currentPage - 1) * TRADES_PER_PAGE;
  const endIndex = startIndex + TRADES_PER_PAGE;
  const currentTrades = closedTrades.slice(startIndex, endIndex);
  
  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardHeader className="pb-4 pt-5 px-5">
          <CardTitle className="text-xl font-headline flex items-center gap-2">
           <History className="h-5 w-5 text-primary" />
           Trade History
          </CardTitle>
          <CardDescription className="text-sm">Loading your past trading activity...</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-12 px-5 pb-5">
          <div className="animate-pulse text-muted-foreground">Loading trade history...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-card border-destructive/50">
        <CardHeader className="pb-4 pt-5 px-5">
          <CardTitle className="text-xl font-headline flex items-center gap-2 text-destructive">
           <AlertTriangle className="h-5 w-5" />
           Error Loading Trades
          </CardTitle>
          <CardDescription className="text-sm text-destructive-foreground/80">Could not load your trade history.</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-12 px-5 pb-5">
          <ServerCrash className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive">{error}</p>
          <p className="text-sm text-muted-foreground mt-2">Please try refreshing the page or check back later.</p>
        </CardContent>
      </Card>
    );
  }
  
  if (closedTrades.length === 0) {
    return (
      <Card className="shadow-card">
        <CardHeader className="pb-4 pt-5 px-5">
          <CardTitle className="text-xl font-headline flex items-center gap-2">
             <History className="h-5 w-5 text-primary" />
             Trade History
          </CardTitle>
          <CardDescription className="text-sm">No completed trades yet.</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg bg-muted/30">
            <History className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Your completed trades will appear here once the bot makes and closes trades.</p>
          </div>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="shadow-card">
      <CardHeader className="pb-4 pt-5 px-5">
        <CardTitle className="text-xl font-headline flex items-center gap-2">
           <History className="h-5 w-5 text-primary" />
           Trade History
        </CardTitle>
        <CardDescription className="text-sm">Review your past trading activity. Trades are sorted by most recent.</CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-5 pb-5">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold bg-muted/50 h-11 px-3">Symbol</TableHead>
                <TableHead className="text-right font-semibold bg-muted/50 h-11 px-3">Buy Price</TableHead>
                <TableHead className="text-right font-semibold bg-muted/50 h-11 px-3">Sell Price</TableHead>
                <TableHead className="text-right font-semibold bg-muted/50 h-11 px-3">Quantity</TableHead>
                <TableHead className="text-right font-semibold bg-muted/50 h-11 px-3">P&amp;L ({currentTrades[0]?.quoteAsset || 'USD'})</TableHead>
                <TableHead className="text-right font-semibold bg-muted/50 h-11 px-3">P&amp;L (%)</TableHead>
                <TableHead className="font-semibold bg-muted/50 h-11 px-3">Closed At</TableHead>
                <TableHead className="font-semibold bg-muted/50 h-11 px-3">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentTrades.map((trade) => (
                <TableRow key={trade.id} className="hover:bg-muted/30">
                  <TableCell className="p-3">
                    <div className="flex items-center gap-2">
                       {trade.baseAsset === 'BTC' ? <Bitcoin className="h-5 w-5 text-orange-400" /> :
                        trade.baseAsset === 'ETH' ? <svg className="h-5 w-5 text-gray-500 dark:text-gray-400" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M15.922 2l-.39 1.12L9.95 17.502l5.972 3.63L21.902 17.5l-5.59-14.38zm.078 21.807l-5.938-3.598 5.938 8.753 5.945-8.753zM22.36 16.97L16 20.178l-6.36-3.208 6.36-6.09z"/></svg> :
                        trade.baseAsset === 'SOL' ? <svg className="h-5 w-5 text-purple-500" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M4.75 2.75a.75.75 0 0 0-.75.75v12.04a.75.75 0 0 0 .75.75h14.5a.75.75 0 0 0 .75-.75V7.543a.75.75 0 0 0-.75-.75H9.295a.75.75 0 0 1-.53-.22L7.046 4.854a.75.75 0 0 0-.53-.22H4.75zm4.545 4.545h10.205V15.H9.295V7.295zM2.75 18.54v-1.75h18.5v1.75a.75.75 0 0 1-.75.75H3.5a.75.75 0 0 1-.75-.75z"/></svg> :
                        <BarChartBig className="h-5 w-5 text-primary" />}
                      <span className="font-medium">{trade.baseAsset}/{trade.quoteAsset}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right p-3">{formatCurrency(trade.buyPrice, trade.quoteAsset)}</TableCell>
                  <TableCell className="text-right p-3">{trade.sellPrice ? formatCurrency(trade.sellPrice, trade.quoteAsset) : 'N/A'}</TableCell>
                  <TableCell className="text-right p-3">{trade.quantity.toLocaleString(undefined, {maximumFractionDigits: 8})}</TableCell>
                  <TableCell className={cn("text-right p-3 font-medium", trade.pnl && trade.pnl >= 0 ? 'text-accent' : 'text-destructive')}>
                    {trade.pnl !== undefined ? formatCurrency(trade.pnl, trade.quoteAsset) : 'N/A'}
                  </TableCell>
                   <TableCell className={cn("text-right p-3 font-medium", trade.pnlPercentage && trade.pnlPercentage >= 0 ? 'text-accent' : 'text-destructive')}>
                    {trade.pnlPercentage !== undefined ? `${trade.pnlPercentage.toFixed(2)}%` : 'N/A'}
                    {trade.pnlPercentage !== undefined ? (trade.pnlPercentage >= 0 ? <TrendingUp className="inline ml-1 h-4 w-4" /> : <TrendingDown className="inline ml-1 h-4 w-4" />) : null}
                  </TableCell>
                  <TableCell className="p-3">{trade.sellTimestamp ? new Date(trade.sellTimestamp).toLocaleDateString() : 'N/A'}</TableCell>
                  <TableCell className="p-3">
                    <Badge 
                      variant={trade.status === 'CLOSED_SOLD' ? 'default' : (trade.status === 'CLOSED_ERROR' ? 'destructive' : 'outline')}
                      className={cn(trade.status === 'CLOSED_SOLD' && "bg-accent/80 hover:bg-accent text-accent-foreground",
                                   trade.status === 'CLOSED_ERROR' && "bg-destructive/80 hover:bg-destructive")}
                    >
                        {trade.status.replace('CLOSED_', '')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-6">
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
