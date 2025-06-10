import { TradeHistoryTable } from "@/components/trades/trade-history-table";

export default function TradesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Trade History</h1>
      </div>
      <TradeHistoryTable />
    </div>
  );
}
