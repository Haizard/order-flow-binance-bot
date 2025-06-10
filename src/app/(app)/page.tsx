import { DollarSign, ListChecks, Bot, TrendingUp } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/metric-card';
import { ActiveTradesList } from '@/components/dashboard/active-trades-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from 'next/image';

export default function DashboardPage() {
  // Placeholder data
  const totalPnl = 1250.75;
  const activeTradesCount = 3;
  const botStatus = "Active";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight font-headline">Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Total P&L"
          value={`$${totalPnl.toLocaleString()}`}
          icon={DollarSign}
          description="Overall profit and loss"
          className="shadow-md"
        />
        <MetricCard
          title="Active Trades"
          value={activeTradesCount.toString()}
          icon={ListChecks}
          description="Currently open positions"
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActiveTradesList />
        </div>
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Performance Overview
            </CardTitle>
            <CardDescription>Visual representation of your trading performance.</CardDescription>
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
            <p className="text-sm text-muted-foreground mt-2 text-center">Performance chart coming soon.</p>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for subtle animation signal for trade execution - could be a toast or dynamic update */}
      {/* For demonstration, imagine a new trade just executed: */}
      {/* <div className="fixed bottom-5 right-5 animate-pulse bg-accent text-accent-foreground p-3 rounded-lg shadow-lg">
        New trade executed: BTC/USDT bought!
      </div> */}
    </div>
  );
}
