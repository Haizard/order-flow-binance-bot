import type { Ticker24hr } from "@/types/binance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bitcoin, TrendingUp, TrendingDown, Activity } from "lucide-react"; // Using Activity as a generic icon

interface MarketOverviewItemProps {
  ticker: Ticker24hr;
}

export function MarketOverviewItem({ ticker }: MarketOverviewItemProps) {
  const priceChangePercent = parseFloat(ticker.priceChangePercent);
  const isPositiveChange = priceChangePercent >= 0;

  let IconComponent;
  switch (ticker.symbol) {
    case "BTCUSDT":
      IconComponent = Bitcoin;
      break;
    // Add more specific icons if available and desired
    // case "ETHUSDT":
    //   IconComponent = SomeEthereumIcon;
    //   break;
    default:
      IconComponent = Activity; // Generic fallback
  }
  
  // Extract base asset from symbol for display (e.g., BTC from BTCUSDT)
  const baseAsset = ticker.symbol.replace(/USDT$/, "").replace(/BUSD$/, "").replace(/TUSD$/, "").replace(/FDUSD$/, "");


  return (
    <Card className="shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <IconComponent className="h-5 w-5 mr-2 text-primary" />
          {baseAsset}/USDT
        </CardTitle>
        {isPositiveChange ? (
          <TrendingUp className="h-5 w-5 text-accent-foreground" />
        ) : (
          <TrendingDown className="h-5 w-5 text-destructive" />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">${parseFloat(ticker.lastPrice).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: ticker.symbol.includes("SHIB") ? 8 : 4})}</div>
        <p className={`text-xs ${isPositiveChange ? "text-accent-foreground" : "text-destructive"}`}>
          {priceChangePercent.toFixed(2)}% (24h)
        </p>
      </CardContent>
    </Card>
  );
}
