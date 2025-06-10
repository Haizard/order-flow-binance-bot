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
import { Bitcoin, TrendingUp, TrendingDown, ArrowLeft, ArrowRight, History } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

interface ClosedTrade {
  id: string;
  symbol: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  pnlUsd: number;
  pnlPercentage: number;
  closedAt: string; // ISO string date
}

// Placeholder data
const closedTrades: ClosedTrade[] = [
  { id: 't1', symbol: 'BTC/USDT', buyPrice: 59000, sellPrice: 60500, quantity: 0.1, pnlUsd: 150, pnlPercentage: 2.54, closedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 't2', symbol: 'ETH/USDT', buyPrice: 2950, sellPrice: 3000, quantity: 1, pnlUsd: 50, pnlPercentage: 1.69, closedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 't3', symbol: 'ADA/USDT', buyPrice: 1.20, sellPrice: 1.15, quantity: 1000, pnlUsd: -50, pnlPercentage: -4.17, closedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  // Add more for pagination testing
  ...Array.from({ length: 18 }, (_, i) => ({
    id: `t${i + 4}`,
    symbol: ['LINK/USDT', 'DOT/USDT', 'XRP/USDT'][i % 3],
    buyPrice: 20 + i,
    sellPrice: 21 + i * 1.1 - (i % 2 === 0 ? 2 : 0),
    quantity: 50,
    pnlUsd: ( (21 + i * 1.1 - (i % 2 === 0 ? 2 : 0)) - (20+i) ) * 50,
    pnlPercentage: (( (21 + i * 1.1 - (i % 2 === 0 ? 2 : 0)) / (20+i) ) - 1) * 100,
    closedAt: new Date(Date.now() - (i + 4) * 24 * 60 * 60 * 1000).toISOString(),
  })),
];

const TRADES_PER_PAGE = 10;

export function TradeHistoryTable() {
  const [currentPage, setCurrentPage] = React.useState(1);

  const totalPages = Math.ceil(closedTrades.length / TRADES_PER_PAGE);
  const startIndex = (currentPage - 1) * TRADES_PER_PAGE;
  const endIndex = startIndex + TRADES_PER_PAGE;
  const currentTrades = closedTrades.slice(startIndex, endIndex);

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };
  
  if (closedTrades.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
          <CardDescription>No completed trades yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Your completed trades will appear here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-headline">
           <History className="h-6 w-6 text-primary" />
           Trade History
        </CardTitle>
        <CardDescription>Review your past trading activity.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Buy Price</TableHead>
                <TableHead className="text-right">Sell Price</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">P&amp;L (USD)</TableHead>
                <TableHead className="text-right">P&amp;L (%)</TableHead>
                <TableHead>Closed At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentTrades.map((trade) => (
                <TableRow key={trade.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <Bitcoin className="h-5 w-5 text-primary" /> {/* Placeholder Icon */}
                      <span className="font-medium">{trade.symbol}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">${trade.buyPrice.toLocaleString()}</TableCell>
                  <TableCell className="text-right">${trade.sellPrice.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{trade.quantity.toLocaleString()}</TableCell>
                  <TableCell className={`text-right font-medium ${trade.pnlUsd >= 0 ? 'text-accent-foreground' : 'text-destructive'}`}>
                    ${trade.pnlUsd.toFixed(2)}
                  </TableCell>
                   <TableCell className={`text-right ${trade.pnlPercentage >= 0 ? 'text-accent-foreground' : 'text-destructive'}`}>
                    {trade.pnlPercentage.toFixed(2)}%
                    {trade.pnlPercentage >= 0 ? <TrendingUp className="inline ml-1 h-4 w-4" /> : <TrendingDown className="inline ml-1 h-4 w-4" />}
                  </TableCell>
                  <TableCell>{new Date(trade.closedAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between pt-4">
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
      </CardContent>
    </Card>
  );
}
