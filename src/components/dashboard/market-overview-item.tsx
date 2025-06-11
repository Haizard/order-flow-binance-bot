import type { Ticker24hr } from "@/types/binance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bitcoin, TrendingUp, TrendingDown, Activity, BarChartBig } from "lucide-react"; 
import { cn } from "@/lib/utils";

interface MarketOverviewItemProps {
  ticker: Ticker24hr;
}

export function MarketOverviewItem({ ticker }: MarketOverviewItemProps) {
  const priceChangePercent = parseFloat(ticker.priceChangePercent);
  const isPositiveChange = priceChangePercent >= 0;

  let IconComponent;
  const baseAsset = ticker.symbol.replace(/USDT$/, "").replace(/BUSD$/, "").replace(/TUSD$/, "").replace(/FDUSD$/, "").replace(/BTC$/, ""); // Handle BTC pairs too

  switch (baseAsset) {
    case "BTC":
      IconComponent = Bitcoin;
      break;
    case "ETH": // Example, add more as needed
      IconComponent = () => <svg className="h-5 w-5 text-primary" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M15.922 2l-.39 1.12L9.95 17.502l5.972 3.63L21.902 17.5l-5.59-14.38zm.078 21.807l-5.938-3.598 5.938 8.753 5.945-8.753zM22.36 16.97L16 20.178l-6.36-3.208 6.36-6.09z"/></svg>;
      break;
    case "SOL":
       IconComponent = () => <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M4.75 2.75a.75.75 0 0 0-.75.75v12.04a.75.75 0 0 0 .75.75h14.5a.75.75 0 0 0 .75-.75V7.543a.75.75 0 0 0-.75-.75H9.295a.75.75 0 0 1-.53-.22L7.046 4.854a.75.75 0 0 0-.53-.22H4.75zm4.545 4.545h10.205V15.H9.295V7.295zM2.75 18.54v-1.75h18.5v1.75a.75.75 0 0 1-.75.75H3.5a.75.75 0 0 1-.75-.75z"/></svg>;
      break;
    default:
      IconComponent = BarChartBig; 
  }
  
  const quoteAsset = ticker.symbol.substring(baseAsset.length);


  return (
    <Card className="shadow-card hover:shadow-card-hover transition-shadow duration-300 ease-in-out">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <IconComponent />
          {baseAsset}<span className="text-xs text-muted-foreground">/{quoteAsset}</span>
        </CardTitle>
        {isPositiveChange ? (
          <TrendingUp className="h-5 w-5 text-accent" />
        ) : (
          <TrendingDown className="h-5 w-5 text-destructive" />
        )}
      </CardHeader>
      <CardContent className="pb-4 px-4">
        <div className="text-2xl font-bold">${parseFloat(ticker.lastPrice).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: ticker.symbol.includes("SHIB") ? 8 : 4})}</div>
        <p className={cn("text-sm font-semibold", isPositiveChange ? "text-accent" : "text-destructive")}>
          {priceChangePercent.toFixed(2)}% (24h)
        </p>
      </CardContent>
    </Card>
  );
}
