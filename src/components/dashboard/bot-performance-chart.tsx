
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { TrendingUp, Activity, Info } from "lucide-react";
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

async function getChartData(userId: string): Promise<ChartDataPoint[]> {
  const closedTrades = await tradeService.getClosedTrades(userId);
  const soldTrades = closedTrades
    .filter(trade => trade.status === 'CLOSED_SOLD' && typeof trade.pnl === 'number' && typeof trade.sellTimestamp === 'number')
    .sort((a, b) => (a.sellTimestamp || 0) - (b.sellTimestamp || 0));

  let cumulativePnl = 0;
  return soldTrades.map(trade => {
    cumulativePnl += trade.pnl || 0;
    return {
      date: format(new Date(trade.sellTimestamp!), "MMM d, HH:mm"),
      cumulativePnl: parseFloat(cumulativePnl.toFixed(2)),
      tradePnl: parseFloat((trade.pnl || 0).toFixed(2)),
      symbol: trade.symbol,
    };
  });
}

export function BotPerformanceChart({ userId }: BotPerformanceChartProps) {
  const [chartData, setChartData] = React.useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const data = await getChartData(userId);
        setChartData(data);
      } catch (error) {
        console.error("Failed to fetch chart data:", error);
        setChartData([]); // Set to empty array on error
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [userId]);

  if (isLoading) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Bot Performance Chart
          </CardTitle>
          <CardDescription>
            Cumulative Profit & Loss (P&L) from closed trades over time. Auto-refreshes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="aspect-[16/9] w-full bg-muted rounded-md flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading chart data...</p>
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
           <CardDescription>
            Cumulative Profit & Loss (P&L) from closed trades over time. Auto-refreshes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="aspect-[16/9] w-full bg-muted rounded-md flex flex-col items-center justify-center">
            <Activity className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No trading data available yet to display the chart.</p>
            <p className="text-xs text-muted-foreground mt-1">Chart will appear once the bot completes trades.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Determine a suitable domain for Y-axis to avoid extreme scales if P&L is small
  const pnlValues = chartData.map(d => d.cumulativePnl);
  const minPnl = Math.min(...pnlValues, 0); // Include 0 in case all P&L is positive or negative
  const maxPnl = Math.max(...pnlValues, 0);
  const padding = Math.max(Math.abs(maxPnl - minPnl) * 0.1, 1); // Add some padding, at least 1 unit

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Bot Performance Chart
        </CardTitle>
        <CardDescription>
         Cumulative Profit & Loss (P&L) from closed trades over time. Auto-refreshes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-[16/9] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 20,
                left: -10, // Adjust to bring Y-axis labels closer
                bottom: 5,
              }}
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
                tickFormatter={(value) => `$${value}`}
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
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Symbol:</span>
                            <span className="font-semibold">{item.symbol || 'N/A'}</span>
                          </div>
                           <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Trade P&L:</span>
                            <span className={`font-semibold ${ (item.tradePnl || 0) >= 0 ? 'text-accent-foreground' : 'text-destructive'}`}>
                              ${(item.tradePnl || 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Cum. P&L:</span>
                            <span className={`font-semibold ${item.cumulativePnl >= 0 ? 'text-accent-foreground' : 'text-destructive'}`}>
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
                dot={chartData.length < 50} // Show dots if few data points
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
         <p className="text-xs text-muted-foreground mt-2 text-center flex items-center justify-center">
            <Info className="h-3 w-3 mr-1.5" /> Hover over the chart line for more details on each trade.
        </p>
      </CardContent>
    </Card>
  );
}

