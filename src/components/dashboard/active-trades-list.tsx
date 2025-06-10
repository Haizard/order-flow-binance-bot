import { Bitcoin, TrendingUp, TrendingDown, Hourglass } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Trade {
  id: string;
  symbol: string;
  buyPrice: number;
  currentPrice: number;
  quantity: number;
  status: 'PURCHASED' | 'TRAILING';
  pnl: number;
  pnlPercentage: number;
}

// Placeholder data
const activeTrades: Trade[] = [
  { id: '1', symbol: 'BTC/USDT', buyPrice: 60000, currentPrice: 61500, quantity: 0.1, status: 'TRAILING', pnl: 150, pnlPercentage: 2.5 },
  { id: '2', symbol: 'ETH/USDT', buyPrice: 3000, currentPrice: 3050, quantity: 1, status: 'PURCHASED', pnl: 50, pnlPercentage: 1.67 },
  { id: '3', symbol: 'SOL/USDT', buyPrice: 150, currentPrice: 155, quantity: 10, status: 'TRAILING', pnl: 50, pnlPercentage: 3.33 },
];

export function ActiveTradesList() {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Trades</CardTitle>
        <CardDescription>Overview of your currently open positions.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead className="text-right">Buy Price</TableHead>
              <TableHead className="text-right">Current Price</TableHead>
              <TableHead className="text-right">P&amp;L</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeTrades.map((trade) => (
              <TableRow key={trade.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Bitcoin className="h-5 w-5 text-primary" /> {/* Placeholder Icon */}
                    <span className="font-medium">{trade.symbol}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">${trade.buyPrice.toLocaleString()}</TableCell>
                <TableCell className="text-right">${trade.currentPrice.toLocaleString()}</TableCell>
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
