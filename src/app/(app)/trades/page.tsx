
import { TradeHistoryTable } from "@/components/trades/trade-history-table";

// Placeholder for current user ID - replace with actual auth system integration
const DEMO_USER_ID = "user123";

export default function TradesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Trade History</h1>
      </div>
      <TradeHistoryTable userId={DEMO_USER_ID} />
    </div>
  );
}
