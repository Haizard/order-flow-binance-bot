

import { TradeHistoryTable } from "@/components/trades/trade-history-table";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";


export default async function TradesPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Trade History</h1>
      </div>
      <TradeHistoryTable userId={session.id} />
    </div>
  );
}
