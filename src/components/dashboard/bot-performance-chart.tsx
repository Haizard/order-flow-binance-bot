
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { TrendingUp, Activity, Info, Loader2 } from "lucide-react";
import * as tradeService from '@/services/tradeService';
import type { Trade } from '@/types/trade';
import { format } from 'date-fns';

interface BotPerformanceChartProps {
  userId: string;
}

interface ChartDataPoint {
  date: string;
  cumulativePnl: number;
  tradePnl?: number;
  symbol?: string;
}

const chartConfig = {
  cumulativePnl: {
    label: "Cumulative P&L (USD)",
    color: "hsl(var(--chart-1))",
  },
};

// This function remains outside the component as it's an async utility
async function getChartData(userId: string): Promise<ChartDataPoint[]> {
  console.log(`[${new Date().toISOString()}] BotPerformanceChart.getChartData: Fetching closed trades for user ${userId}`);
  const closedTrades = await tradeService.getClosedTrades(userId);
  console.log(`[${new Date().toISOString()}] BotPerformanceChart.getChartData: Raw closed trades fetched: ${closedTrades.length}`);

  const soldTrades = closedTrades
    .filter(trade => {
      const isValidSoldTrade = trade.status === 'CLOSED_SOLD' && typeof trade.pnl === 'number' && typeof trade.sellTimestamp === 'number';
      if (trade.status === 'CLOSED_SOLD' && (!isValidSoldTrade)) {
          console.warn(`[${new Date().toISOString()}] BotPerformanceChart.getChartData: Filtered out CLOSED_SOLD trade ${trade.symbol} (ID: ${trade.id}) due to missing pnl/sellTimestamp. PNL: ${trade.pnl}, Timestamp: ${trade.sellTimestamp}`);
      }
      return isValidSoldTrade;
    })
    .sort((a, b) => (a.sellTimestamp || 0) - (b.sellTimestamp || 0));
  console.log(`[${new Date().toISOString()}] BotPerformanceChart.getChartData: Filtered 'CLOSED_SOLD' trades with valid P&L/Timestamp: ${soldTrades.length}`);

  let cumulativePnl = 0;
  const dataPoints = soldTrades.map(trade => {
    cumulativePnl += trade.pnl || 0;
    return {
      date: format(new Date(trade.sellTimestamp!), "MMM d, HH:mm"),
      cumulativePnl: parseFloat(cumulativePnl.toFixed(2)),
      tradePnl: parseFloat((trade.pnl || 0).toFixed(2)),
      symbol: trade.symbol,
    };
  });
  console.log(`[${new Date().toISOString()}] BotPerformanceChart.getChartData: Generated ${dataPoints.length} data points for chart.`);
  return dataPoints;
}

export function BotPerformanceChart({ userId }: BotPerformanceChartProps) {
  const [chartData, setChartData] = React.useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    console.log(`[${new Date().toISOString()}] BotPerformanceChart: useEffect triggered for userId: ${userId}. Fetching data.`);
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getChartData(userId);
        setChartData(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred fetching chart data.";
        console.error(`[${new Date().toISOString()}] BotPerformanceChart: Failed to fetch chart data:`, errorMessage);
        setError(errorMessage);
        setChartData([]);
      } finally {
        setIsLoading(false);
        console.log(`[${new Date().toISOString()}] BotPerformanceChart: Data fetching complete. isLoading set to false.`);
      }
    }
    if (userId) {
        fetchData();
    } else {
        console.warn(`[${new Date().toISOString()}] BotPerformanceChart: userId is not available in useEffect. Skipping data fetch.`);
        setIsLoading(false);
        setError("User ID not provided to chart component.");
    }
  }, [userId]);

  if (isLoading) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Bot Performance Chart
          </CardTitle>
          <CardDescription className="flex items-center text-xs text-muted-foreground">
            <Info className="h-3 w-3 mr-1.5 flex-shrink-0" />
            Cumulative Profit & Loss (P&L) from closed trades over time. Auto-refreshes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="aspect-[16/9] w-full bg-muted rounded-md flex flex-col items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Loading chart data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Bot Performance Chart
          </CardTitle>
           <CardDescription className="flex items-center text-xs text-muted-foreground">
            <Info className="h-3 w-3 mr-1.5 flex-shrink-0" />
            Cumulative Profit & Loss (P&L) from closed trades over time. Auto-refreshes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="aspect-[16/9] w-full bg-muted rounded-md flex flex-col items-center justify-center text-center p-4">
            <Activity className="h-10 w-10 text-destructive mb-2" />
            <p className="text-sm font-semibold text-destructive">Error loading chart data</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Bot Performance Chart
          </CardTitle>
           <CardDescription className="flex items-center text-xs text-muted-foreground">
            <Info className="h-3 w-3 mr-1.5 flex-shrink-0" />
            Cumulative Profit & Loss (P&L) from closed trades over time. Auto-refreshes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="aspect-[16/9] w-full bg-muted rounded-md flex flex-col items-center justify-center text-center p-4">
            <Activity className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No <code className="bg-muted-foreground/10 px-1 py-0.5 rounded text-xs">CLOSED_SOLD</code> trades with P&amp;L data found yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Chart will appear once the bot completes and successfully sells trades.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pnlValues = chartData.map(d => d.cumulativePnl);
  const minPnl = Math.min(...pnlValues, 0);
  const maxPnl = Math.max(...pnlValues, 0);
  const padding = Math.max(Math.abs(maxPnl - minPnl) * 0.1, 1);

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Bot Performance Chart
        </CardTitle>
        <CardDescription className="flex items-center text-xs text-muted-foreground">
         <Info className="h-3 w-3 mr-1.5 flex-shrink-0" />
         Cumulative Profit & Loss (P&L) from <code className="bg-muted-foreground/10 px-1 py-0.5 rounded text-xs">CLOSED_SOLD</code> trades over time. Auto-refreshes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-[16/9] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${value.toFixed(2)}`} // Ensure P&L values are formatted to 2 decimal places
                domain={[minPnl - padding, maxPnl + padding]}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(label, payload) => {
                       if (payload && payload.length > 0 && payload[0].payload) {
                         return payload[0].payload.date;
                       }
                       return label;
                    }}
                    formatter={(value, name, props) => {
                      const item = props.payload as ChartDataPoint;
                      return (
                        <div className="space-y-1 text-sm p-1">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground mr-2">Symbol:</span>
                            <span className="font-semibold">{item.symbol || 'N/A'}</span>
                          </div>
                           <div className="flex items-center justify-between">
                            <span className="text-muted-foreground mr-2">Trade P&amp;L:</span>
                            <span className={`font-semibold ${ (item.tradePnl || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              ${(item.tradePnl || 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground mr-2">Cum. P&amp;L:</span>
                            <span className={`font-semibold ${item.cumulativePnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              ${item.cumulativePnl.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                }
              />
              <Line
                dataKey="cumulativePnl"
                type="monotone"
                stroke="var(--color-cumulativePnl)"
                strokeWidth={2}
                dot={chartData.length < 50}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
         <p className="text-xs text-muted-foreground mt-2 text-center flex items-center justify-center">
            <Info className="h-3 w-3 mr-1.5 flex-shrink-0" /> Hover over the chart line for more details on each trade.
        </p>
      </CardContent>
    </Card>
  );
}
