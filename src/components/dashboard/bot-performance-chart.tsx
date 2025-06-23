
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

async function getChartData(userId: string): Promise<ChartDataPoint[]> {
  console.log(`[${new Date().toISOString()}] BotPerformanceChart.getChartData: Fetching closed trades for user ${userId}`);
  const closedTrades = await tradeService.getClosedTrades(userId);
  console.log(`[${new Date().toISOString()}] BotPerformanceChart.getChartData: Raw closed trades fetched: ${closedTrades.length}`);

  const exitedTrades = closedTrades
    .filter(trade => {
      const isValidExitedTrade = trade.status === 'CLOSED_EXITED' && typeof trade.pnl === 'number' && typeof trade.exitTimestamp === 'number';
      if (trade.status === 'CLOSED_EXITED' && (!isValidExitedTrade)) {
          console.warn(`[${new Date().toISOString()}] BotPerformanceChart.getChartData: Filtered out CLOSED_EXITED trade ${trade.symbol} (ID: ${trade.id}) due to missing pnl/exitTimestamp. PNL: ${trade.pnl}, Timestamp: ${trade.exitTimestamp}`);
      }
      return isValidExitedTrade;
    })
    .sort((a, b) => (a.exitTimestamp || 0) - (b.exitTimestamp || 0));
  console.log(`[${new Date().toISOString()}] BotPerformanceChart.getChartData: Filtered 'CLOSED_EXITED' trades with valid P&L/Timestamp: ${exitedTrades.length}`);

  let cumulativePnl = 0;
  const dataPoints = exitedTrades.map(trade => {
    cumulativePnl += trade.pnl || 0;
    return {
      date: format(new Date(trade.exitTimestamp!), "MMM d, HH:mm"),
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

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="aspect-[16/9] w-full bg-muted/30 rounded-lg flex flex-col items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading chart data...</p>
        </div>
      );
    }
  
    if (error) {
      return (
        <div className="aspect-[16/9] w-full bg-muted/30 rounded-lg flex flex-col items-center justify-center text-center p-4">
          <Activity className="h-10 w-10 text-destructive mb-2" />
          <p className="text-sm font-semibold text-destructive">Error loading chart data</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
      );
    }
  
    if (chartData.length === 0) {
      return (
        <div className="aspect-[16/9] w-full bg-muted/30 rounded-lg flex flex-col items-center justify-center text-center p-4 border border-dashed">
          <Activity className="h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No <code className="bg-muted-foreground/10 px-1 py-0.5 rounded text-xs">CLOSED_EXITED</code> trades with P&amp;L data.</p>
          <p className="text-xs text-muted-foreground mt-1">Chart appears after bot completes profitable trades.</p>
        </div>
      );
    }

    const pnlValues = chartData.map(d => d.cumulativePnl);
    const minPnl = Math.min(...pnlValues, 0);
    const maxPnl = Math.max(...pnlValues, 0);
    const padding = Math.max(Math.abs(maxPnl - minPnl) * 0.1, 5); // Ensure some padding

    return (
      <>
        <ChartContainer config={chartConfig} className="aspect-[16/9] w-full h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 20, left: -15, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value.toFixed(0)}`} 
                  domain={[minPnl - padding, maxPnl + padding]}
                />
                <ChartTooltip
                  cursor={true}
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
                          <div className="space-y-1 text-xs p-1.5 rounded-md shadow-lg bg-background border border-border">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground mr-2">Symbol:</span>
                              <span className="font-semibold">{item.symbol || 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground mr-2">Trade P&amp;L:</span>
                              <span className={`font-semibold ${ (item.tradePnl || 0) >= 0 ? 'text-accent' : 'text-destructive'}`}>
                                ${(item.tradePnl || 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground mr-2">Cum. P&amp;L:</span>
                              <span className={`font-semibold ${item.cumulativePnl >= 0 ? 'text-accent' : 'text-destructive'}`}>
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
                  strokeWidth={2.5}
                  dot={chartData.length < 30}
                  activeDot={{ r: 6, style: { fill: "var(--color-cumulativePnl)", stroke: "var(--background)", strokeWidth: 2 } }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
          <p className="text-xs text-muted-foreground mt-3 text-center flex items-center justify-center">
              <Info className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" /> Hover over the chart line for trade details.
          </p>
      </>
    );
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-4 pt-5 px-5">
        <CardTitle className="text-xl font-headline flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Bot Performance Chart
        </CardTitle>
        <CardDescription className="text-sm flex items-center text-muted-foreground">
         <Info className="h-4 w-4 mr-1.5 flex-shrink-0" />
         Cumulative P&L from <code className="bg-muted-foreground/10 px-1.5 py-0.5 rounded text-xs mx-1">CLOSED_EXITED</code> trades. Auto-refreshes.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-5 pb-5">
        {renderContent()}
      </CardContent>
    </Card>
  );
}
